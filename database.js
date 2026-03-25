import { MongoClient } from 'mongodb';
import config from './dbConfig.json' with { type: 'json' };

const url = `mongodb+srv://${config.userName}:${config.password}@${config.hostname}`;

const client = new MongoClient(url);
const db = client.db('rental');
const collection = db.collection('house');

async function main() {
	try {
		await db.command({ ping: 1 });
		console.log(`DB connected to ${config.hostname}`);
	} catch (ex) {
		console.log(`Connection failed to ${url} because ${ex.message}`);
		process.exit(1);
	}

	try {
		const house = {
			name: 'Beachfront views',
			summary: 'From your bedroom to the beach, no shoes required',
			property_type: 'Condo',
			beds: 1,
		};

		await collection.insertOne(house);
		console.log('Inserted document');

		const query = { property_type: 'Condo', beds: { $lt: 2 } };
		const options = {
			sort: { name: -1 },
			limit: 10,
		};

		const cursor = collection.find(query, options);
		const rentals = await cursor.toArray();
		rentals.forEach((i) => console.log(i));

		// await collection.deleteMany(query);
	} catch (ex) {
		console.log(`Database (${url}) error: ${ex.message}`);
	} finally {
		await client.close();
	}
}

main();