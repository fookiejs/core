import { lifecycle } from "../.."

const everybody: LifecycleFunction = async function (payload, state) {
    return true
}
export default everybody
