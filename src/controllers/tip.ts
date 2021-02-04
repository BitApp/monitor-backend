import {Controller, POST} from "@src/infrastructure/decorators/koa";
import {IRouterContext} from "koa-router";
import {AuthRequired} from "@src/infrastructure/decorators/auth";
import {jsonResponse} from "@src/infrastructure/utils";
import {
  BillType,
  ConsumeType,
  NotificationType,
  RESPONSE_CODE,
  SLACK_WEB_HOOK
} from "@src/infrastructure/utils/constants";
import PostModel from "@src/models/post";
import UserModel from "@src/models/user";
import TipPaymentModel from "@src/models/tipPayment";
import {notificationProducer} from "@src/services/producer/notificationProducer";
import {CheckTipAmount} from "@src/infrastructure/decorators/checkTipAmount";
import {sendSlackWebHook} from "@src/infrastructure/slack";
import {createBill} from "@src/infrastructure/bill";

@Controller({prefix: "/tip"})
export default class TipController {
  @POST("")
  @AuthRequired()
  @CheckTipAmount()
  async tip(ctx: IRouterContext) {
    const uuid = ctx.state.user.uuid;
    const amount = ctx.request.body.amount;
    const postId = ctx.request.body.postId;
    let target = ctx.request.body.targetUser;
    if (!target && !postId) {
      ctx.body = jsonResponse({code: RESPONSE_CODE.ERROR, msg: "must select the user or post"});
      return
    }
    const session = await TipPaymentModel.db.startSession({
      defaultTransactionOptions: {
        readConcern: {level: "snapshot"},
        writeConcern: {w: "majority"}
      }
    });
    session.startTransaction();

    if (postId) {
      const post = await PostModel.findOne({_id: postId}, {from: 1, tips: 1}, {session});
      if (post) {
        target = post.from
        post.tips = (post.tips ?? 0) + 1;
        await post.save();
      }
    }
    if (target === uuid) {
      ctx.body = jsonResponse({code: RESPONSE_CODE.ERROR, msg: "You can't tip yourself"});
    } else {
      const user = await UserModel.findOne({uuid}, {balance: 1, uuid: 1}, {session});
      if (user && user.balance > amount && await UserModel.exists({uuid: target})) {
        user.balance -= amount
        await user.save();
        const [payment] = await TipPaymentModel.create([{uuid, target, amount, postId}], {session});
        await createBill({
          uuid,
          target,
          type: BillType.consume,
          amount,
          consumeType: ConsumeType.tip,
          consumeId: payment._id
        }, session)
        await session.commitTransaction();
        session.endSession();
        const msg = {type: postId ? NotificationType.postTip : NotificationType.tip, uuid: target, from: uuid, postId, amount};
        await notificationProducer.publish(JSON.stringify(msg));

        await sendSlackWebHook(SLACK_WEB_HOOK.TIP, `[https://mfans.com/u/${uuid}]打赏了$${amount}给主播[https://mfans.com/u/${target}]`);

        ctx.body = jsonResponse({code: RESPONSE_CODE.NORMAL});
        return
      }
      ctx.body = jsonResponse({code: RESPONSE_CODE.BALANCE_NOT_ENOUGH});
    }

    if (session.inTransaction()) {
      await session.abortTransaction();
      session.endSession();
    }
  }
}