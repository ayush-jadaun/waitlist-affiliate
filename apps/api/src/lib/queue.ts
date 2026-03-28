import { Queue, Worker, type Processor } from "bullmq";
import type { Redis } from "ioredis";

export function createQueue(name: string, connection: Redis): Queue {
  return new Queue(name, { connection });
}

export function createWorker<T>(
  name: string,
  processor: Processor<T>,
  connection: Redis,
  concurrency = 1
): Worker<T> {
  return new Worker(name, processor, { connection, concurrency });
}
