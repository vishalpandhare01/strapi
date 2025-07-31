/**
 * order controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
    async recent(ctx) {
        try {
            const now = new Date();
            const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

            let pageSize = 10
            let page = 1

            if (ctx.query.page) {
                page = Number(ctx.query.page)
            }
            if (ctx.query.pageSize) {
                pageSize = Number(ctx.query.pageSize)

            }

            const total = (await strapi.db.query('api::order.order').findMany({
                where: {
                    createdAt: {
                        $gte: fortyEightHoursAgo.toISOString(),
                    },
                    order_status: {
                        $ne: 'timeout'
                    }
                },
            })).length

            const entries = await strapi.db.query('api::order.order').findMany({
                where: {
                    createdAt: {
                        $gte: fortyEightHoursAgo.toISOString(),
                    },
                    order_status: {
                        $ne: 'timeout'
                    }
                },
                orderBy: { createdAt: 'DESC' },
                offset: page,
                limit: pageSize,
            });

            return {
                data: entries,
                meta: {
                    pagination: {
                        page,
                        pageSize,
                        pageCount: Math.ceil(total / pageSize),
                        total,
                    }
                }
            };
        } catch (err) {
            ctx.throw(500, err);
        }
    },

    async history(ctx) {
        try {
            const now = new Date();
            const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
            let pageSize = 10
            let page = 1

            if (ctx.query.page) {
                page = Number(ctx.query.page)
            }
            if (ctx.query.pageSize) {
                pageSize = Number(ctx.query.pageSize)
            }

            const total = (await strapi.db.query('api::order.order').findMany({
                where: {
                    createdAt: {
                        $lt: fortyEightHoursAgo.toISOString(),
                    },
                    order_status: {
                        $ne: 'timeout'
                    }
                },
            })).length
            const entries = await strapi.db.query('api::order.order').findMany({
                where: {
                    createdAt: {
                        $lt: fortyEightHoursAgo.toISOString(),
                    },
                    order_status: {
                        $ne: 'timeout'
                    }
                },
                orderBy: { createdAt: 'DESC' },
                offset: page,
                limit: pageSize,
            });

            return {
                data: entries,
                meta: {
                    pagination: {
                        page,
                        pageSize,
                        pageCount: Math.ceil(total / pageSize),
                        total,
                    }
                }
            };
        } catch (err) {
            ctx.throw(500, err);
        }
    },

    async createFromCart(ctx) {
        try {
            const userId = ctx.state.user.id;
            const order = await strapi.service('api::cart.cart').createOrderFromCart(userId);
            return { data: order };
        } catch (error) {
            return ctx.badRequest(error.message);
        }
    }
}));
