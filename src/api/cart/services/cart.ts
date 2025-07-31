/**
 * cart service
 */

import { factories } from '@strapi/strapi';
import cron from 'node-cron';

export default factories.createCoreService('api::cart.cart', ({ strapi }) => ({
    async calculateMealStock(mealId: number): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stockEvents = await strapi.db.query('api::stock-event.stock-event').findMany({
            where: {
                meal: mealId,
                event_time: {
                    $gte: today.toISOString()
                }
            }
        });

        return stockEvents.reduce((total, event) => {
            return total + (event.type === 'INCREMENT' ? event.quantity : -event.quantity);
        }, 0);
    },

    async cleanupExpiredCarts() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const expiredCarts = await strapi.db.query('api::cart.cart').findMany({
            where: {
                createdAt: {
                    $lt: fiveMinutesAgo.toISOString()
                }
            },
            populate: ['stock_events']
        });

        for (const cart of expiredCarts) {
            // Delete associated stock events
            if (cart.stock_events) {
                for (const event of cart.stock_events) {
                    await strapi.entityService.delete('api::stock-event.stock-event', event.id);
                }
            }
            // Delete the cart
            await strapi.entityService.delete('api::cart.cart', cart.id);
        }
    },

    async addToCart(userId: number, mealId: number, quantity: number) {
        try {
            // Check if meal exists and get store info
            const meal = await strapi.db.query('api::meal.meal').findOne({
                where: { id: mealId },
                populate: { store: true }
            });
            if (!meal) {
                throw new Error('Meal not found');
            }

            // Check stock availability
            const currentStock = await this.calculateMealStock(mealId);
            if (currentStock < quantity) {
                throw new Error('Insufficient stock');
            }

            // Get or create user's cart
            let cart = await strapi.db.query('api::cart.cart').findOne({
                where: { users_permissions_user: userId },
                populate: ['store', 'meals']
            });

            // If cart exists, validate store
            if (cart) {
                if (cart.store.id !== meal.store.id) {
                    throw new Error('Cannot add meals from different stores to cart');
                }
            } else {
                // Create new cart
                cart = await strapi.entityService.create('api::cart.cart', {
                    data: {
                        users_permissions_user: userId,
                        store: meal.store.id,
                        total: 0,
                        cart_meta: {},
                        publishedAt: new Date()
                    }
                });
            }

            // Update cart_meta with quantities
            const cartMeta = cart.cart_meta || {};
            cartMeta[mealId] = (cartMeta[mealId] || 0) + quantity;

            // Calculate new total
            let total = 0;
            for (const [mealId, qty] of Object.entries(cartMeta)) {
                const mealPrice = (await strapi.entityService.findOne('api::meal.meal', parseInt(mealId))).price;
                total += mealPrice * (qty as number);
            }

            // Create stock event for the decrement
            await strapi.entityService.create('api::stock-event.stock-event', {
                data: {
                    meal: mealId,
                    quantity: quantity,
                    type: 'DECREMENT',
                    event_source: 'customer',
                    event_time: new Date(),
                    publishedAt: new Date()
                }
            });

            // Update cart with new data
            const updatedCart = await strapi.db.query('api::cart.cart').update({
                where: { id: cart.id },
                data: {
                    meals: [{ id: mealId }],
                    cart_meta: cartMeta,
                    total: total
                }
            });

            return updatedCart;
        } catch (error) {
            throw error;
        }
    },

    async removeFromCart(userId: number, mealId: number) {
        try {
            // Get user's cart
            const cart = await strapi.db.query('api::cart.cart').findOne({
                where: { users_permissions_user: userId },
                populate: ['meals']
            });

            if (!cart) {
                throw new Error('Cart not found');
            }

            // Check if meal exists in cart
            const cartMeta = cart.cart_meta || {};
            const quantityToRestore = cartMeta[mealId] || 0;

            if (quantityToRestore === 0) {
                throw new Error('Meal not found in cart');
            }

            // Create compensating stock event
            await strapi.entityService.create('api::stock-event.stock-event', {
                data: {
                    meal: mealId,
                    quantity: quantityToRestore,
                    type: 'INCREMENT',
                    event_source: 'customer',
                    event_time: new Date(),
                    publishedAt: new Date()
                }
            });

            // Remove meal from cart_meta
            delete cartMeta[mealId];

            // Recalculate total
            let total = 0;
            for (const [mealId, qty] of Object.entries(cartMeta)) {
                const mealPrice = (await strapi.entityService.findOne('api::meal.meal', parseInt(mealId))).price;
                total += mealPrice * (qty as number);
            }

            // Update cart
            const updatedCart = await strapi.db.query('api::cart.cart').update({
                where: { id: cart.id },
                data: {
                    meals: cart.meals.filter(m => m.id !== mealId).map(m => ({ id: m.id })),
                    cart_meta: cartMeta,
                    total: total
                }
            });

            return updatedCart;
        } catch (error) {
            throw error;
        }
    },

    async bootstrap() {
        // Run cart cleanup every minute
        cron.schedule('* * * * *', async () => {
            await this.cleanupExpiredCarts();
        });
    },

    async createOrderFromCart(userId: number) {
        try {
            // Get user's cart with all necessary relations
            const cart = await strapi.db.query('api::cart.cart').findOne({
                where: { users_permissions_user: userId },
                populate: ['meals', 'store', 'users_permissions_user']
            });

            if (!cart) {
                throw new Error('Cart not found');
            }

            if (!cart.meals || cart.meals.length === 0) {
                throw new Error('Cart is empty');
            }

            // Generate order number
            const randomDigits = Math.floor(Math.random() * (99999999999 - 1000000) + 1000000).toString();
            const orderNumber = `YDXX${randomDigits}`;

            // Create order items snapshot
            const orderItems = await Promise.all(cart.meals.map(async (meal) => {
                const quantity = cart.cart_meta[meal.id] || 0;
                // Get full meal details for snapshot
                const fullMeal = await strapi.entityService.findOne('api::meal.meal', meal.id, {
                    populate: ['store']
                });
                return {
                    ...fullMeal,
                    quantity
                };
            }));

            // Create order
            const order = await strapi.entityService.create('api::order.order', {
                data: {
                    order_number: orderNumber,
                    user: userId,
                    store: cart.store.id,
                    effective_order_date: new Date(),
                    order_items: orderItems,
                    order_cancelled_items: [],
                    order_status: 'created',
                    order_value: cart.total,
                    publishedAt: new Date()
                }
            });

            // Schedule timeout check
            setTimeout(async () => {
                const currentOrder = await strapi.entityService.findOne('api::order.order', order.id);
                if (currentOrder && currentOrder.order_status === 'created') {
                    await strapi.entityService.update('api::order.order', order.id, {
                        data: {
                            order_status: 'timeout'
                        }
                    });
                }
            }, 15 * 60 * 1000); // 15 minutes

            // Delete the cart after order creation
            await strapi.entityService.delete('api::cart.cart', cart.id);

            return order;
        } catch (error) {
            throw error;
        }
    }
}));
