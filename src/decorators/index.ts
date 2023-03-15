
const queue:any[] = []
import * as lodash from "lodash"
import { model } from ".."


export function Model(_model:ModelInterface){
    return function(target:Function){
        _model.name = lodash.lowerCase(target.name)  
        _model.schema= {}
        _model.bind = {}  
        _model.mixins = []     

        while(queue.length > 0){
            const {key , field} = queue.pop()
            _model.schema[key] = field
        }
        model(_model)
    }
}

export function Field(field:FieldInterface){
    return function(target:any, key:string){
       queue.push({key, ...field}) 
    }
}