import {Schema, Types, model, Document} from "mongoose";

const required = true;

export interface Post extends Document {
  from: number,
  media?: string[],
  content?: string;
  deleted?: boolean;
  like?: number;
  comment?: number;
}

const PostModel: Schema = new Schema({
  from: {type: Number, required},
  media: {type: Array(String), default: []},
  content: {type: String, default: ""},
  like: {type: Number, default: 0},
  comment: {type: Number, default: 0},
  deleted: {type: Boolean, default: false}
}, {
  timestamps: true
});

export default model<Post>("post", PostModel);
