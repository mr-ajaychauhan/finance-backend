import { createClient } from "redis";

let redisClient: any;

export const connectRedis = async () => {
  try {
    redisClient = createClient({
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    });

    redisClient.on("error", (err: any) => {
      console.error("Redis Client Error", err);
    });

    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
};

export const getRedisClient = () => redisClient;

export const setCache = async (
  key: string,
  value: any,
  expireInSeconds = 1
) => {
  try {
    if (redisClient) {
      await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
    }
  } catch (error) {
    console.error("Cache set error:", error);
  }
};

export const getCache = async (key: string) => {
  try {
    if (redisClient) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    }
  } catch (error) {
    console.error("Cache get error:", error);
  }
  return null;
};

export const deleteCache = async (key: string) => {
  try {
    if (redisClient) {
      await redisClient.del(key);
    }
  } catch (error) {
    console.error("Cache delete error:", error);
  }
};
