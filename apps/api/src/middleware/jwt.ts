import type { FastifyInstance } from "fastify";
import fjwt from "@fastify/jwt";

export async function registerJwt(app: FastifyInstance, secret: string) {
  await app.register(fjwt, { secret });

  app.decorate("authenticateAdmin", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
