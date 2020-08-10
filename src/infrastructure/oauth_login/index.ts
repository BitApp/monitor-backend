// @ts-ignore
import config from "config";
import {Strategy as FacebookStrategy} from "passport-facebook"
import {OAuth2Strategy as GoogleStrategy} from "passport-google-oauth"
import {Strategy as TwitterStrategy} from "passport-twitter"
import UserModel from "../../models/user";
import passport from "koa-passport"
import {OAUTH} from "../utils/constants"
import {GoogleProfile, User} from "@src/interface";
import {getUserSequence} from "../utils/sequence";

export function loaderPassport(oauthList: OAUTH[]) {

  passport.serializeUser((user: any, cb) => {
    cb(null, user.uuid)
  });

  passport.deserializeUser((uuid, cb) => {
    cb(null, {uuid})
  });

  oauthList.forEach(item => {
    switch (item) {
      case OAUTH.FACEBOOK:
        addFaceBookStrategy();
        break;
      case OAUTH.GOOGLE:
        addGoogleStrategy();
        break;
      case OAUTH.TWITTER:
        addTwitterStrategy();
        break;
      default:
        throw Error(`not support ${item} oauth`)
    }
  })
}

function addFaceBookStrategy() {
  passport.use(
    new FacebookStrategy(
      {
        clientID: config.FACEBOOK.Client_Id,
        clientSecret: config.FACEBOOK.Client_Secret,
        callbackURL: `${config.HOST}/oauth/facebook/callback`,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, cb) => {
        console.log(profile);
        // const googleProfile: GoogleProfile = profile as GoogleProfile;
        // if (!req.user) {
        //   const user = await findOrCreateUser(OAUTH.FACEBOOK, googleProfile);
        //   cb(null, user)
        // } else {
        //   const user = await bindUser(OAUTH.FACEBOOK, googleProfile, (req.user as { uuid: number }).uuid);
        //   cb(null, user)
        // }
      }
    )
  );
}

function addGoogleStrategy() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE.Client_Id,
        clientSecret: config.GOOGLE.Client_Secret,
        callbackURL: `${config.HOST}/oauth/google/callback`,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, cb) => {
        delete profile._json;
        delete profile._raw;
        const googleProfile: GoogleProfile = profile as GoogleProfile;
        try {
          if (!req.user) {
            const user = await findOrCreateUser(OAUTH.GOOGLE, googleProfile);
            cb(null, user)
          } else {
            const user = await bindUser(OAUTH.GOOGLE, googleProfile, (req.user as { uuid: number }).uuid);
            cb(null, user)
          }
        } catch (e) {
          cb(null, null, e.message)
        }
      }
    )
  );
}

function addTwitterStrategy() {
  passport.use(
    new TwitterStrategy(
      {
        consumerKey: "213",
        consumerSecret: "123",
        callbackURL: `${config.HOST}/oauth/twitter/callback`,
        passReqToCallback: true
      },
      (req, token, tokenSecret, profile, cb) => {
        if (!req.user) {
          // TODO Not logged-in
        } else {
          // TODO  Logged in. Associate Twitter account with user
        }
        return cb(null, profile)
      }
    )
  );
}

export async function findOrCreateUser(provider: OAUTH, profile: GoogleProfile): Promise<User> {
  let filter;
  let update;
  switch (provider) {
    case OAUTH.GOOGLE:
      filter = {google: profile.id};
      update = {$setOnInsert: {google: profile.id}, $set: {"oauth_profile.google": profile}};
      break;
    // case OAUTH.FACEBOOK:
    //   filter = {facebook: profile.id};
    //   update = {$setOnInsert: {facebook: profile.id}, $set: {"oauth_profile.facebook": profile}};
    //   break;
    default:
      throw Error("provider not exists")
  }
  const tmp = await UserModel.findOneAndUpdate(
    filter, update, {new: true, upsert: true, rawResult: true}
  );
  if (!tmp.lastErrorObject.updatedExisting) {
    tmp.value!.uuid = await getUserSequence();
    tmp.value!.save()
  }
  return tmp.value as User
}

export async function bindUser(provider: OAUTH, profile: GoogleProfile, uuid: number): Promise<User> {
  let filter;
  let update;
  let oauth;
  switch (provider) {
    case OAUTH.GOOGLE:
      oauth = {google: profile.id};
      filter = {uuid};
      update = {$set: {"oauth_profile.google": profile, google: profile.id}};
      break;
    // case OAUTH.FACEBOOK:
    //   filter = {uuid};
    //   update = {$setOnInsert: {facebook: profile.id}, $set: {"oauth_profile.facebook": profile}};
    //   break;
    default:
      throw Error("provider not exists")
  }
  const oauthExists = await UserModel.findOne(oauth);
  if (oauthExists && oauthExists.uuid !== uuid) {
    throw Error(`${provider} account has been used`)
  }
  const user = await UserModel.findOneAndUpdate(filter, update);
  if (user) {
    return user as User
  } else {
    throw Error("user not exists")
  }

}
