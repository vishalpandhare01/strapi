/**
 * meal service
 */

import { factories } from '@strapi/strapi';
import cron from 'node-cron';

export default factories.createCoreService('api::meal.meal', ({ strapi }) => ({
    async createRecurringStockEvents() {
        try {
            // Find all meals with recurring_stock
            const meals = await strapi.db.query('api::meal.meal').findMany({
                where: {
                    recurring_stock: {
                        $gt: 0
                    },
                    available_to_purchase: true,
                },
                populate: {
                    store: true
                }
            })
             const enabledMeals = meals.filter(meal => meal.store?.enabled);

            // Create stock events for each meal
            for (const meal of enabledMeals) {
                await strapi.entityService.create('api::stock-event.stock-event', {
                    data: {
                        meal: meal.id,
                        quantity: meal.recurring_stock,
                        type: 'INCREMENT',
                        event_source: 'store',
                        event_time: new Date(),
                        publishedAt: new Date()
                    },
                });
            }
        } catch (error) {
            console.error('Error creating recurring stock events:', error);
        }
    },

    async bootstrap() {
        // Schedule the job to run at midnight (00:00)
        cron.schedule('0 0 * * *', async () => {
            await this.createRecurringStockEvents();
        });
    }
}));
