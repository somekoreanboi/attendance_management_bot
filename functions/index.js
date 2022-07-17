/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
const functions = require("firebase-functions");
const express = require("express");
const request = require("request-promise");
const fs = require("fs");
const app = express();
const jwt = require("jsonwebtoken");


const tokenUrl = "https://auth.worksmobile.com/oauth2/v2.0/token";
const boturl = "https://www.worksapis.com/v1.0/bots/3930684";

const clientId = "xxj5ARzzVw5k1H2_WgZC";
const clientSecret = "6Hu3OP9qxy";
const serviceAccount = "944ny.serviceaccount@corisetec.com";
const privateKey = fs.readFileSync("jwtRS256.key");

let accessToken = "";
let refreshToken = "";
let bearer = "";

let gotInitialToken = false;

let getWorkStartTimeMod = false;
let getWorkEndTimeMod = false;

// 봇이 메시지를 수신할경우 콜백
app.post("/receive", (req, res) => {
  getToken().then(()=> {
    console.log(req.body);
    const userId = req.body.source.userId;

    if (getWorkStartTimeMod) {
      getWorkStartTimeMod = false;
      getWorkEndTimeMod = true;
      sendMessage(userId, {
        "content": {
          "type": "text",
          // eslint-disable-next-line max-len
          "text": "이어서, 같은 방법으로 연장근로 완료 시각을 년, 월, 일, 시각을 조합한 10자리 숫자로 입력해주세요.",
        },
      });
      const startTime = parseTime(req.body.content.text);
      console.log(startTime);
      return;
    }

    if (getWorkEndTimeMod) {
      getWorkEndTimeMod = false;
      const endTime = parseTime(req.body.content.text);
      console.log(endTime);
      return;
    }

    if (req.body.type == "join") {
      sendMessage(userId, {
        "content": {
          "type": "text",
          // eslint-disable-next-line max-len
          "text": "근태 관리 봇의 첫 이용을 환영합니다! /n하단의 메뉴에서(PC의 경우 좌측 하단의 작은 선 세개), 이용하시고 싶은 서비스를 선택해주세요. \n문의 사항이 있으시다면 해외데이터팀의 임재원 사원에게 문의 부탁드립니다!",
        },
      });
      return;
    }

    // Postback type 콜백 케이스
    if (req.body.type == "postback") {
      if (req.body.data == "휴가신청을 누르셨습니다.") {
        sendMessage(userId, {
          "content": {
            "type": "button_template",
            "contentText": "어떤 종류의 휴가 신청을 희망하시나요?",
            "actions": [
              {
                "type": "message",
                "label": "일반 휴가 신청",
                "postback": "normal_break",
                "text": "일반 휴가를 신청하고 싶어요.",
              }, {
                "type": "message",
                "label": "병가 신청",
                "postback": "sick_break",
                "displayText": "병가를 신청하고 싶어요.",
              }],
          },
        });
        return;
      }

      if (req.body.data == "연장 근로 신청을 누르셨습니다.") {
        sendMessage(userId,
            {
              "content": {
                "type": "button_template",
                "contentText": "어떤 종류의 연장근로 신청을 희망하시나요?",
                "actions": [
                  {
                    "type": "message",
                    "label": "휴일 연장근로 신청",
                    "postback": "holiday_work",
                    "text": "휴일 연장근로를 신청하고 싶어요.",
                  }, {
                    "type": "message",
                    "label": "비휴일 연장근로 신청",
                    "postback": "non_holiday_work",
                    "text": "비휴일 연장근로를 신청하고 싶어요.",
                  }],
              },
            }).catch((error)=> {
          console.log(error.message);
          getNewToken();
        });
        return;
      }
    }

    // 메시지 타입인 경우(버튼 선택한 경우) 콜백 케이스
    if (req.body.type == "message") {
      if (req.body.content.postback == "holiday_work") {
        getWorkStartTimeMod = true;
        sendMessage(userId, {
          "content": {
            "type": "text",
            // eslint-disable-next-line max-len
            "text": "휴일 연장근로를 선택하셨습니다. 2022071718과 같이, 연장근로 시작 시각을 년, 월, 일, 시각을 조합한 10자리 숫자로 입력해주세요.",
          },
        });

        console.log("휴일 연장근로");
        return;
      }

      if (req.body.content.postback == "non_holiday_work") {
        console.log("비휴일 연장근로");
      }

      if (req.body.content.postback == "normal_break") {
        console.log("일반 휴가");
      }

      if (req.body.content.postback == "sick_break") {
        console.log("병가");
      }
    }
  });
});


/**
 * Send message to the user
 * @param {string} userId the id of the user
 * @param {any} message the message that shall be sent
 * @return {Promise} the result promise of the request.
 */
function sendMessage(userId, message) {
  return request.post({
    uri: boturl + "/users/" + userId + "/messages",
    headers: {
      "Authorization": bearer,
      "Content-Type": "application/json"},
    method: "POST",
    json: message,
  });
}


/**
 * Get Initial Access Token
 * @return {Promise} the result promise of the request.
 */
function getToken() {
  // 이미 받았으면 아무것도 하지 말기
  if (gotInitialToken) {
    return new Promise((resolve, reject) => {});
  }
  // JWT 토큰 생성
  const token = jwt.sign(
      {
        "iss": clientId,
        "sub": serviceAccount,
        "iat": parseInt(Date.now() / 1000),
        "exp": parseInt(Date.now() / 1000) + 3600,
      }, privateKey,
      {
        algorithm: "RS256",
      });


  // Access Token 리퀘스트 바디
  const data = {
    "assertion": token,
    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
    "client_id": clientId,
    "client_secret": clientSecret,
    // eslint-disable-next-line max-len
    "scope": "bot,bot.read,user.read,user,user.email.read,calendar,calendar.read,contact,contact.read",
  };

  return request.post({
    uri: tokenUrl,
    headers: {"Content-Type": "application/x-www-form-urlencoded=UTF-8"},
    method: "POST",
    formData: data,
  },
  (error, response, body) => {
    repeatRefresh();
    gotInitialToken = true;
    accessToken = JSON.parse(body).access_token;
    refreshToken = JSON.parse(body).refresh_token;
    bearer = "Bearer " + accessToken;
  });
}


/**
 * Get new token using refresh token
 * @return {Promise} the result promise of the request.
 */
function getNewToken() {
  return request.post({
    uri: boturl,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"},
    method: "POST",
    formData: {
      "refresh_token": refreshToken,
      "grant_type": "refresh_token",
      "client_id": clientId,
      "client_secret": clientSecret},
  },
  (error, response, body) => {
    accessToken = JSON.parse(body).access_token;
  });
}

/**
 * Keep updating token every 23 hours
 */
function repeatRefresh() {
  if (gotInitialToken) {
    getNewToken();
  }
  setTimeout(repeatRefresh, 82800 * 1000);
}


/**
 * Modify Bot
 * @return {Promise} the result promise of the request.
 */
function modifyBot() {
  return request.patch({
    uri: boturl,
    headers: {
      "Authorization": bearer,
      "Content-Type": "application/json"},
    method: "PATCH",
    json: {
      "defaultRichmenuId": "144561",
    },
  },
  (error, response, body) => {
    console.log(body);
  });
}

/**
 * Get the upload link of the file to the bot
 * @return {Promise} the result promise of the request.
 * @param {string} fileName the name of the file
 */
function getUploadLink(fileName) {
  return request.post({
    uri: boturl + "/attachments",
    headers: {
      "Authorization": bearer,
      "Content-Type": "application/json"},
    method: "POST",
    json: {
      "fileName": fileName,
    },
  },
  (error, response, body) => {
    return uploadFile(body.uploadUrl, fileName);
  });
}


/**
 * Upload file using the acquired link
 * @param {string} uploadUrl the URL used to upload file
 * @param {string} fileName the name of the file
 * @return {Promise} the result promise of the request.
 */
function uploadFile(uploadUrl, fileName) {
  console.log(uploadUrl);
  const img = fs.createReadStream(fileName);
  return request.post({
    uri: uploadUrl,
    headers: {
      "Authorization": bearer,
      "Content-Type": "multipart/form-data"},
    method: "POST",
    formData: {
      "title": fileName,
      "file": img,
    },
  },
  (error, response, body) => {
    console.log(body);
  });
}


/**
 * Make rich menn
 * @return {Promise} the result promise of the request.
 */
function makeRichMenu() {
  const richMenuBody = {
    "richmenuName": "Extra Work Richmenu",
    "size": {
      "width": 2500,
      "height": 843,
    },
    "areas": [
      {
        "action": {
          "type": "postback",
          "label": "비휴일 연장근로 신청",
          "data": "non_holiday",
          "displayText": "비휴일 연장근로를 신청하고 싶어요.",
        },
        "bounds": {
          "x": 0,
          "y": 0,
          "width": 833,
          "height": 843,
        },
      },
      {
        "action": {
          "type": "postback",
          "label": "휴일 연장근로 신청",
          "data": "holiday",
          "displayText": "휴일 연장근로를 신청하고 싶어요.",
        },
        "bounds": {
          "x": 833,
          "y": 0,
          "width": 833,
          "height": 843,
        },
      },
      {
        "action": {
          "type": "postback",
          "label": "처음으로",
          "data": "reset_rich",
          "displayText": "초기 메뉴로 돌아가고 싶어요.",
        },
        "bounds": {
          "x": 1666,
          "y": 0,
          "width": 834,
          "height": 843,
        },
      },
    ],
  };

  return request.post({
    uri: boturl + "/richmenus",
    headers: {
      "Authorization": bearer,
      "Content-Type": "application/json",
    },
    method: "POST",
    json:
      richMenuBody,
  },
  (error, response, body) => {
    console.log(body);
  });
}

/**
 * Set richmenu image
 * @return {Promise} the result promise of the request.
 */
function setRichImage() {
  return request.post({
    uri: boturl + "/richmenus/144569/image",
    headers: {
      "Authorization": bearer,
      "Content-Type": "application/json"},
    method: "POST",
    json: {
      "fileId": "kr1.1658043106986968991.1658129506.1.3930684.0.0.0"},
  },
  (error, response, body) => {
    console.log(body);
  });
}

/**
 * view the list of rich menu
 * @return {Promise} the result promise of the request.
 */
function viewRichMenus() {
  return request.get({
    uri: boturl + "/richmenus",
    headers: {"Authorization": bearer},
    method: "GET",
  },
  (error, response, body) => {
    console.log(body);
  });
}

/**
 * delete rich menu
 * @param {string} richMenuId the ID of the richmenu
 * @return {Promise} the result promise of the request.
 */
function deleteRichMenu(richMenuId) {
  return request.delete({
    uri: boturl + "/richmenus/" + richMenuId.toString(),
    headers: {
      "Authorization": bearer},
    method: "DELETE",
  },
  (error, response, body) => {
    console.log(body);
  });
}

/**
 * Change richmenu targeting a particular user
 * @param {string} richMenuId the ID of the richmenu
 * @param {string} userId the Id of the user
 * @return {Promise} the result promise of the request.
 */
function changeRichMenu(richMenuId, userId) {
  return request.post({
    uri: boturl + "/richmenus/" + richMenuId + "/users/" + userId,
    headers: {
      "Authorization": bearer},
    method: "POST",
  },
  (error, response, body) => {
    console.log(response);
  });
}

function parseTime(str) {
  try {
    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);
    const hour = str.substring(8, 10);
    return new Date(year, month-1, day, hour);
  } catch (error) {
    return Date.now;
  }
}

// /api prefix를 가지는 요청을 express 라우터로 전달
exports.bot = functions.region("asia-northeast3").runWith({
  minInstances: 2,
}).https.onRequest(app);
