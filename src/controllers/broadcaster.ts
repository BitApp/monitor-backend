import {Controller, GET} from "@src/infrastructure/decorators/koa";
import {IRouterContext} from "koa-router";
import {AuthRequired} from "@src/infrastructure/decorators/auth";
import BillModel from "../models/bill";
import UserModel from "../models/user";

@Controller({prefix: "/broadcaster"})
export default class Broadcaster {
  @GET("/balance")
  @AuthRequired()
  async balance(ctx: IRouterContext) {
    const uuid = ctx.state.user.uuid;
    const userFields = {_id: 0, broardcaster: 1};
    const user = await UserModel.findOne({uuid}, userFields);
    if (user && user.broardcaster) {

    } else {

    }
  }
}