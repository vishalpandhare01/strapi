/**
 * cart controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::cart.cart', ({ strapi }) => ({
    async addToCart(ctx) {
        try {
            const { mealId, quantity } = ctx.request.body;
            const userId = ctx.state.user.id;

            if (!mealId || !quantity || quantity <= 0) {
                return ctx.badRequest('Invalid meal ID or quantity');
            }

            const cart = await strapi.service('api::cart.cart').addToCart(userId, mealId, quantity);
            return { data: cart };
        } catch (error) {
            return ctx.badRequest(error.message);
        }
    },
    async removeFromCart(ctx) {
        try {
            const { mealId } = ctx.request.body;
            const userId = ctx.state.user.id;

            if (!mealId) {
                return ctx.badRequest('Meal ID is required');
            }

            const cart = await strapi.service('api::cart.cart').removeFromCart(userId, mealId);
            return { data: cart };
        } catch (error) {
            return ctx.badRequest(error.message);
        }
    }
}));
