import { Collection, MongoClient, WithId, FilterQuery } from "mongodb";
import config from "../config";
import Logger from "../util/Logger";
import Timers from "../util/Timers";
import deasync from "deasync";
import IORedis from "ioredis";
import {
	Album, AlbumProperties,
	Image, ImageProperties,
	User, UserProperties
} from "./models";
import {
	CreateAlbumOptions, GetAlbumOptions,
	CreateImageOptions, GetImageOptions,
	CreateUserOptions, GetUserOptions
} from "../util/@types/Database";
import { Plural } from "../util/@types/Utilities";


export type Names = "album" | "image" | "user";
export type CollectionNames = `${Names}s`;

class Database {
	static connection: MongoClient;
	static r: IORedis.Redis;
	private constructor() {
		throw new TypeError("This class may not be instantiated, use static methods.");
	}

	static init() {
		const r = this.r = new IORedis(config.services.redis.port, config.services.redis.host, {
			password: config.services.redis.password,
			db: config.services.redis.db,
			enableReadyCheck: true,
			autoResendUnfulfilledCommands: true,
			connectionName: "YiffyGraphics"
		});

		r
			.on("connect", () => Logger.debug("Redis", `Connected to redis://${config.services.redis.host}:${config.services.redis.port} (db: ${config.services.redis.db})`))


		try {
			const t = new Timers(false);
			t.start("connect");
			Logger.debug("Database", `Connecting to mongodb://${config.services.db.host}:${config.services.db.port}?retryWrites=true&w=majority (SSL: ${config.services.db.options.ssl ? "Yes" : "No"})`);
			this.connection = deasync(MongoClient.connect)(`mongodb://${config.services.db.host}:${config.services.db.port}/?retryWrites=true&w=majority`, config.services.db.options);
			t.end("connect");
			Logger.debug("Database", `Connected to mongodb://${config.services.db.host}:${config.services.db.port}?retryWrites=true&w=majority (SSL: ${config.services.db.options.ssl ? "Yes" : "No"}) in ${t.calc("connect")}ms`);
		} catch (e) {
			Logger.error("Database", `Error connecting to MongoDB instance (mongodb://${config.services.db.host}:${config.services.db.port}?retryWrites=true&w=majority, SSL: ${config.services.db.options.ssl ? "Yes" : "No"})\nReason: ${e?.stack || e}`);
			return; // don't need to rethrow it as it's already logged
		}
	}

	static get Redis() { return this.r; }
	static get mongo() { return this.connection; }
	static get mdb() { return this.mongo.db(config.services.db.db); }

	static async executeRedisQuery<K extends keyof IORedis.Commands, V = string>(cmd: K, ...args: Parameters<IORedis.Commands[K]>): Promise<V | null> {
		const start = performance.now();
		let v: V;
		try {
			v = await this.r.send_command(cmd, ...args as any);
		} catch (e) {
			Logger.error("Redis", e);
			return null;
		}
		const end = performance.now();
		Logger.error(["Redis", `${cmd.toUpperCase()} ${args[0]}`], parseFloat((end - start).toFixed(3)));
		return v || null;
	}

	static collection(col: "albums"): Collection<WithId<AlbumProperties>>;
	static collection(col: "images"): Collection<WithId<ImageProperties>>;
	static collection(col: "users"): Collection<WithId<UserProperties>>;
	static collection<T = any>(col: string): Collection<T>;
	static collection(col: string) {
		// I cannot be bothered to overengineer these types
		return this.mdb.collection(col);
	}

	// get/create: https://github.com/TheYiffGuru/Main/blob/81b7e92eed1e9d402bfc2a1b6cd9d3e109150fe2/src/db/index.ts#L78-L101
}

Database.init();

const { mongo, mdb } = Database;

export {
	Database as db,
	mdb,
	mongo
};
export default Database;
