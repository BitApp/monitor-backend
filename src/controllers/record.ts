import { Controller, GET, PUT } from "@src/infrastructure/decorators/koa";
import { PaginationDec } from "@src/infrastructure/decorators/pagination";
import { Pagination } from "@src/interface";
import { IRouterContext } from "koa-router";
import recordModel, { IRecord } from "@src/models/record";
import { jsonResponse } from "@src/infrastructure/utils";
import { RESPONSE_CODE } from "@src/infrastructure/utils/constants";
import config from "@src/infrastructure/utils/config";
import { Types } from "mongoose";

@Controller({ prefix: "/records" })
export default class RecordController {

  @GET("/running")
  async getRunningRecord(ctx: IRouterContext) {
    const fields = {
      first_settle_time: 1,
      hold: 1,
      refill: 1,
      next_settle_time: 1,
      symbol: 1,
      longex: 1,
      shortex: 1,
      price: 1,
      long_funding_fee: 1,
      short_funding_fee: 1,
      long_funding_rate:1,
      long_funding_rate_next:1,
      short_funding_rate: 1,
      short_funding_rate_next: 1,
      long_open_volume: 1,
      short_open_volume: 1,
      max_volume: 1,
      long_open_balance: 1,
      short_open_balance: 1,
      long_final_price: 1,
      short_final_price: 1,
      long_open_price: 1,
      short_open_price: 1,
      profit: 1
    };
    const records = await recordModel.find({}, fields).sort({ _id: -1 }).limit(1);
    const rec: IRecord = records[0].toJSON();
    if (rec.profit == null) {
      ctx.body = jsonResponse({ code: RESPONSE_CODE.NORMAL, data: rec });
    } else {
      ctx.body = jsonResponse({ code: RESPONSE_CODE.NORMAL });
    }
  }

  @GET("")
  @PaginationDec()
  async getRecords(ctx: IRouterContext) {
    const pagination: Pagination = ctx.state.pagination;
    const fields = {
      _id: 1,
      first_settle_time: 1,
      next_settle_time: 1,
      symbol: 1,
      longex: 1,
      shortex: 1,
      long_funding_fee: 1,
      short_funding_fee: 1,
      long_funding_rate:1,
      short_funding_rate: 1,
      long_open_volume: 1,
      short_open_volume: 1,
      long_final_volume: 1,
      short_final_volume: 1,
      max_volume: 1,
      long_open_balance: 1,
      short_open_balance: 1,
      long_final_price: 1,
      short_final_price: 1,
      long_close_balance: 1,
      short_close_balance: 1,
      profit: 1,
      "fulfillment.task_id": 1,
      "fulfillment.fee": 1,
      "fulfillment.totalFee": 1
    };
    const records = await recordModel.aggregate([
      {$match: {}},
      {$sort: {_id: -1}},
      {$skip: pagination.offset},
      {$limit: pagination.limit},
      // {
      //   $lookup: {
      //     from: "fulfillments",
      //     localField: "_id",
      //     foreignField: "task_id",
      //     as: "fulfillment"
      //   }
      // },
      // {
      //   $group: {
      //     _id: "$_id",
      //     totalFee: { $sum: "$fulfillment.fee" },
      //   }
      // },
      {$project: fields}
    ]);
    const total = await recordModel.countDocuments();
    ctx.body = jsonResponse({ code: RESPONSE_CODE.NORMAL, data: { records, total } });
  }

  @GET("/stats")
  async statsData(ctx: IRouterContext) {
    const totalProfitRecords = await recordModel.aggregate([
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$profit" },
        }
      }
    ]);
    const latestRecord = await recordModel.find({}, {first_settle_time: 1}).sort({ _id: -1 }).limit(1);
    const firstRecord = await recordModel.find({}, {first_settle_time: 1}).sort({ _id: 1 }).limit(1);
    const lastTime = new Date(latestRecord[0].first_settle_time);
    const firstTime = new Date(firstRecord[0].first_settle_time);
    let duration = lastTime.getTime() - firstTime.getTime();
    ctx.body = jsonResponse({
      code: RESPONSE_CODE.NORMAL, data:
        {
          balance: config.FINACIAL.balance,
          totalProfit: totalProfitRecords[0].totalProfit,
          days: duration / 1000 / 3600 / 24
        }
    });
  }
}
