import { DataSource, DataSourceOptions, EntitySchema } from "typeorm"
import { Database, defaults, Method, Model, models } from "@fookiejs/core"

const database = Database.create({
	key: "typeorm",
	primaryKeyType: defaults.type.string,

	connect: async function () {
	},

	disconnect: async function () {
	},

	modify: function (model: typeof Model) {
		return {
			[Method.CREATE]: async function (payload) {
				return {} as any
			},

			[Method.READ]: async function (payload) {
				return []
			},

			[Method.UPDATE]: async function () {
				return true
			},

			[Method.DELETE]: async function (payload) {
				return true
			},
		}
	},
})

export const initializeDataSource = async function (options: DataSourceOptions) {
	const entities = []
	for (const model of models) {
		const schema = model.schema()

		return new EntitySchema({
			name: model.getName(),
			tableName: model.getName(),
			columns: Object.entries(schema).reduce((acc, [key, value]) => {
				if (key === "id") {
					acc[key] = {
						primary: true,
						type: model.database().primaryKeyType,
						nullable: false,
					}
				} else {
					acc[key] = {
						type: value.type.key,
						nullable: !value.features.includes(defaults.feature.required),
						unique: value.features.includes(defaults.feature.unique),
					}
				}

				return acc
			}, {}),
		})
	}

	const dataSource = new DataSource({ ...options, entities })
	await dataSource.initialize()
	return dataSource
}
