import worker from "./.open-next/worker.js";

export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

export default {
  fetch: worker.fetch,
  async scheduled(event, env, ctx) {
    const req = new Request("https://internal/api/cron/index", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(worker.fetch(req, env, ctx));
  },
};
