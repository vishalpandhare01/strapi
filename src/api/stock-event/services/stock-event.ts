/**
 * stock-event service
 */

interface MealWithStore {
  id: number;
  enabled: boolean;
  store: {
    id: number;
    enabled: boolean;
  } | null;
}
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::stock-event.stock-event', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;

  const mealId = data?.meal?.connect?.id;
    if (!mealId) {
      return ctx.badRequest('Meal ID is required');
    }

    // Fetch meal with store and check enabled flags
    const meal = await strapi.entityService.findOne('api::meal.meal', mealId, {
      populate: ['store'],
    })as any

    if (!meal) {
      return ctx.badRequest('Invalid meal');
    }

    if (!meal.available_to_purchase) {
      return ctx.badRequest('Meal is not available to purchase');
    }

    const store = meal.store;
    if (!store) {
      return ctx.badRequest('No store associated with this meal.');
    }

    if (meal.recurring_stock <= 0){
         return ctx.badRequest('stock is empty');
    }

    if (!store.enabled) {
      return ctx.badRequest('The associated store is disabled.');
    }


    // Proceed with default create
    return await super.create(ctx);
  },
}));
