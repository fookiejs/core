export default async function db_disconnect(payload, state) {
    await payload.model.database.disconnect()
}
