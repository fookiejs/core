import { it, describe, assert,  } from "vitest"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Text } from "../src/types"

describe("fookie", async function(){
    it("Decorators" , async function(){
        @Model({database: Store})
        
        class User{
            @Field({type: Text, required:true})
            name:string

            @Field({type: Text, required:true})
            password:string
        }
    })
})