/**
 * order router
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/orders/recent',
      handler: 'order.recent',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/orders/history',
      handler: 'order.history',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // Add core routes if you want (optional)
    {
      method: 'GET',
      path: '/orders',
      handler: 'order.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/orders/:id',
      handler: 'order.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/orders',
      handler: 'order.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
