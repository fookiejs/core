module.exports = {
    name: "db_disconnect",
    wait: true,
    function: async function (payload, ctx, state) {
        await state.database.disconnect()
    },
}
