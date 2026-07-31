"use strict";

/**
 * ============================================================================
 * QueueTime v1.0.1 Final
 * script.js
 * ----------------------------------------------------------------------------
 * フロントエンド制御
 *
 * ・QRコード読取
 * ・API通信
 * ・利用開始／終了
 * ・待ち時間取得
 * ・画面更新
 * ・Debug表示
 *
 * ============================================================================
 */


/* ============================================================================
 * API設定
 * ========================================================================== */

const API = Object.freeze({

  URL:
    "https://script.google.com/macros/s/AKfycbzVWN0MIi6j26fHXqLhZGh5f1PFkt1nWk5MN1U44f_z3sjFB2aZ8pIjoA5eKLcyDzDgLA/exec",

  CONTENT_TYPE:
    "application/json",

  TIMEOUT:
    30000,

  WAITTIME_INTERVAL:
    30000

});


/* ============================================================================
 * DOM取得
 * ========================================================================== */

const DOM = Object.freeze({

  qrReader:
    document.getElementById("qr-reader"),

  message:
    document.getElementById("message"),

  httpStatus:
    document.getElementById("http-status"),

  fetchStatus:
    document.getElementById("fetch-status"),

  response:
    document.getElementById("response-body"),

  debug:
    document.getElementById("debug-log"),

  input:
    document.getElementById("qr-input"),

  startButton:
    document.getElementById("start-button"),

  endButton:
    document.getElementById("end-button"),

  waitTime:
    document.getElementById("wait-time-value")

});


/* ============================================================================
 * 状態管理
 * ========================================================================== */

const STATE = {

  scanner:
    null,

  currentQR:
    "",

  scanning:
    false,

  communicating:
    false,

  waitTimer:
    null

};


/* ============================================================================
 * Debug
 * ========================================================================== */

function debugLog(message) {

  const time =
    new Date()
      .toLocaleTimeString("ja-JP");

  const log =
    `[${time}] ${message}`;

  if (
    DOM.debug.textContent === "-" ||
    DOM.debug.textContent.trim() === ""
  ) {

    DOM.debug.textContent =
      log;

    return;

  }

  DOM.debug.textContent =
    log +
    "\n" +
    DOM.debug.textContent;

}


/* ============================================================================
 * UI共通
 * ========================================================================== */

function setMessage(message) {

  DOM.message.className =
    "message";

  DOM.message.textContent =
    message;

}


function setSuccess(message) {

  DOM.message.className =
    "message success";

  DOM.message.textContent =
    message;

}


function setError(message) {

  DOM.message.className =
    "message error";

  DOM.message.textContent =
    message;

}


function setHttpStatus(status) {

  DOM.httpStatus.textContent =
    String(status);

}


function setFetchStatus(status) {

  DOM.fetchStatus.textContent =
    status;

}


function setResponse(response) {

  DOM.response.textContent =
    JSON.stringify(
      response,
      null,
      2
    );

}


function setWaitTime(minutes) {

  if (
    typeof minutes !== "number" ||
    Number.isNaN(minutes)
  ) {

    DOM.waitTime.textContent =
      "-- 分";

    return;

  }

  DOM.waitTime.textContent =
    `${minutes} 分`;

}


/* ============================================================================
 * QR取得
 * ========================================================================== */

function getCurrentQR() {

  if (
    STATE.currentQR !== ""
  ) {

    return STATE.currentQR;

  }

  return DOM.input.value.trim();

}


/* ============================================================================
 * QRクリア
 * ========================================================================== */

function clearQR() {

  STATE.currentQR =
    "";

  STATE.scanning =
    false;

  DOM.input.value =
    "";

}


/* ============================================================================
 * QR入力チェック
 * ========================================================================== */

function validateQR() {

  const qr =
    getCurrentQR();

  if (
    qr === ""
  ) {

    setError(
      "QR番号を入力してください"
    );

    return false;

  }

  return true;

}


/* ============================================================================
 * 通信状態
 * ========================================================================== */

function lockCommunication() {

  STATE.communicating =
    true;

  DOM.startButton.disabled =
    true;

  DOM.endButton.disabled =
    true;

}


function unlockCommunication() {

  STATE.communicating =
    false;

  DOM.startButton.disabled =
    false;

  DOM.endButton.disabled =
    false;

}


/* ============================================================================
 * 初期画面
 * ========================================================================== */

function initializeScreen() {

  setMessage(
    "待機中"
  );

  setHttpStatus("-");

  setFetchStatus("-");

  setWaitTime(null);

  DOM.response.textContent =
    "-";

  DOM.debug.textContent =
    "-";

}


/* ============================================================================
 * QRスキャナー初期化
 * ========================================================================== */

function initializeScanner() {

  if (
    STATE.scanner !== null
  ) {

    return;

  }

  STATE.scanner =
    new Html5Qrcode(
      "qr-reader"
    );

}


/* ============================================================================
 * QR読取成功
 * ========================================================================== */

async function onScanSuccess(decodedText) {

  if (
    STATE.communicating ||
    STATE.scanning
  ) {

    return;

  }

  STATE.scanning =
    true;

  STATE.currentQR =
    decodedText.trim();

  DOM.input.value =
    STATE.currentQR;

  debugLog(
    `QR読取成功 : ${STATE.currentQR}`
  );

  setSuccess(
    "QRコードを読み取りました"
  );

  await stopScanner();

}


/* ============================================================================
 * QR読取失敗
 * ========================================================================== */

function onScanFailure() {

  /*
   * 読取失敗は頻繁に発生するため
   * ログ・画面更新は行わない
   */

}


/* ============================================================================
 * 利用可能カメラ取得
 * ========================================================================== */

async function getCameraConfig() {

  const cameras =
    await Html5Qrcode.getCameras();

  if (
    !cameras ||
    cameras.length === 0
  ) {

    throw new Error(
      "カメラが見つかりません。"
    );

  }

  /*
   * 背面カメラを優先
   */

  const backCamera =
    cameras.find(camera => {

      const label =
        camera.label.toLowerCase();

      return (
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("environment")
      );

    });

  return (
    backCamera ??
    cameras[0]
  );

}


/* ============================================================================
 * QRスキャナー開始
 * ========================================================================== */

async function startScanner() {

  try {

    initializeScanner();

    const camera =
      await getCameraConfig();

    await STATE.scanner.start(

      camera.id,

      {

        fps: 10,

        qrbox: {

          width: 250,

          height: 250

        }

      },

      onScanSuccess,

      onScanFailure

    );

    debugLog(
      "カメラ起動"
    );

  } catch (error) {

    console.error(error);

    debugLog(
      error.message
    );

    setError(
      "カメラを起動できません"
    );

  }

}


/* ============================================================================
 * QRスキャナー停止
 * ========================================================================== */

async function stopScanner() {

  if (
    STATE.scanner === null
  ) {

    return;

  }

  try {

    await STATE.scanner.stop();

    debugLog(
      "カメラ停止"
    );

  } catch (error) {

    /*
     * 停止済みなどの例外は無視
     */

  }

}


/* ============================================================================
 * QRスキャナー再開
 * ========================================================================== */

async function restartScanner() {

  clearQR();

  await startScanner();

  debugLog(
    "カメラ再開"
  );

}


/* ============================================================================
 * QR読取完了通知
 * ========================================================================== */

function notifyQRCodeReady() {

  if (
    getCurrentQR() === ""
  ) {

    return;

  }

  setMessage(
    "開始または終了を選択してください"
  );

  debugLog(
    "QR準備完了"
  );

}


/* ============================================================================
 * 手動入力監視
 * ========================================================================== */

function watchQRCode() {

  const qr =
    DOM.input.value.trim();

  if (
    qr === ""
  ) {

    clearQR();

    return;

  }

  STATE.currentQR =
    qr;

  notifyQRCodeReady();

}


/* ============================================================================
 * API通信
 * ========================================================================== */

async function postAPI(body) {

  lockCommunication();

  setFetchStatus(
    "通信中..."
  );

  setHttpStatus("-");

  debugLog(
    `送信 : ${JSON.stringify(body)}`
  );

  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(
      () => controller.abort(),
      API.TIMEOUT
    );

  try {

    const response =
      await fetch(

        API.URL,

        {

          method:
            "POST",

          body:
            JSON.stringify(body),

          signal:
            controller.signal

        }

      );

    window.clearTimeout(
      timeoutId
    );

    setHttpStatus(
      response.status
    );

    const json =
      await response.json();

    setFetchStatus(
      "成功"
    );

    setResponse(
      json
    );

    debugLog(
      `受信 : ${JSON.stringify(json)}`
    );

    return json;

  } catch (error) {

    window.clearTimeout(
      timeoutId
    );

    if (
      error.name ===
      "AbortError"
    ) {

      setFetchStatus(
        "Timeout"
      );

      setError(
        "通信がタイムアウトしました"
      );

      debugLog(
        "通信タイムアウト"
      );

    } else {

      setFetchStatus(
        "失敗"
      );

      setError(
        "通信エラー"
      );

      debugLog(
        error.message
      );

    }

    return {

      success: false,

      message:
        error.message,

      data: null

    };

  } finally {

    unlockCommunication();

  }

}


/* ============================================================================
 * 利用開始API
 * ========================================================================== */

async function requestStart(
  qrNumber
) {

  return await postAPI({

    action:
      "START",

    qrNumber:
      qrNumber

  });

}


/* ============================================================================
 * 利用終了API
 * ========================================================================== */

async function requestEnd(
  qrNumber
) {

  return await postAPI({

    action:
      "END",

    qrNumber:
      qrNumber

  });

}


/* ============================================================================
 * 待ち時間取得API
 * ========================================================================== */

async function requestWaitTime() {

  return await postAPI({

    action:
      "GET_WAIT_TIME"

  });

}


/* ============================================================================
 * APIレスポンス共通処理
 * ========================================================================== */

function handleApiResult(
  result
) {

  if (
    !result
  ) {

    setError(
      "レスポンス取得失敗"
    );

    return false;

  }

  if (
    !result.success
  ) {

    setError(

      result.message ||

      "処理に失敗しました"

    );

    debugLog(

      `失敗 : ${result.message}`

    );

    return false;

  }

  if (
    result.message
  ) {

    setSuccess(
      result.message
    );

  }

  return true;

}


/* ============================================================================
 * 共通例外処理
 * ========================================================================== */

function handleUnexpectedError(
  error
) {

  console.error(
    error
  );

  debugLog(
    error.message
  );

  setError(
    "予期しないエラーが発生しました"
  );

  unlockCommunication();

}


/* ============================================================================
 * 利用開始処理
 * ========================================================================== */

async function startUse() {

  if (
    STATE.communicating
  ) {

    return;

  }

  if (
    !validateQR()
  ) {

    return;

  }

  const qrNumber =
    getCurrentQR();

  setMessage(
    "利用開始処理中..."
  );

  debugLog(
    `START : ${qrNumber}`
  );

  const result =
    await requestStart(
      qrNumber
    );

  if (
    !handleApiResult(result)
  ) {

    await restartScanner();

    return;

  }

  clearQR();

  await updateWaitTime();

  await restartScanner();

}


/* ============================================================================
 * 利用終了処理
 * ========================================================================== */

async function endUse() {

  if (
    STATE.communicating
  ) {

    return;

  }

  if (
    !validateQR()
  ) {

    return;

  }

  const qrNumber =
    getCurrentQR();

  setMessage(
    "利用終了処理中..."
  );

  debugLog(
    `END : ${qrNumber}`
  );

  const result =
    await requestEnd(
      qrNumber
    );

  if (
    !handleApiResult(result)
  ) {

    await restartScanner();

    return;

  }

  if (
    result.data &&
    result.data.usageMinutes !== undefined
  ) {

    debugLog(
      `利用時間 : ${result.data.usageMinutes}分`
    );

  }

  clearQR();

  await updateWaitTime();

  await restartScanner();

}


/* ============================================================================
 * STARTボタン
 * ========================================================================== */

async function onStartButtonClick() {

  try {

    await startUse();

  } catch (error) {

    handleUnexpectedError(
      error
    );

    await restartScanner();

  }

}


/* ============================================================================
 * ENDボタン
 * ========================================================================== */

async function onEndButtonClick() {

  try {

    await endUse();

  } catch (error) {

    handleUnexpectedError(
      error
    );

    await restartScanner();

  }

}


/* ============================================================================
 * Enterキー押下
 * ========================================================================== */

async function onInputKeyDown(
  event
) {

  if (
    event.key !== "Enter"
  ) {

    return;

  }

  event.preventDefault();

  /*
   * Enterキーは
   * 利用開始を実行
   */

  await startUse();

}


/* ============================================================================
 * QR入力変更
 * ========================================================================== */

function onInputChanged() {

  watchQRCode();

}


/* ============================================================================
 * ボタン状態更新
 * ========================================================================== */

function updateButtonState(
  disabled
) {

  DOM.startButton.disabled =
    disabled;

  DOM.endButton.disabled =
    disabled;

}


/* ============================================================================
 * 通信開始UI
 * ========================================================================== */

function beginCommunication() {

  updateButtonState(
    true
  );

  setFetchStatus(
    "通信中..."
  );

}


/* ============================================================================
 * 通信終了UI
 * ========================================================================== */

function finishCommunication() {

  updateButtonState(
    false
  );

  if (
    DOM.fetchStatus.textContent ===
    "通信中..."
  ) {

    setFetchStatus(
      "待機"
    );

  }

}


/* ============================================================================
 * 現在の待ち時間取得
 * ========================================================================== */

async function updateWaitTime() {

  try {

    const result =
      await requestWaitTime();

    if (
      !result ||
      !result.success
    ) {

      debugLog(
        "待ち時間取得失敗"
      );

      setWaitTime(null);

      return;

    }

    const waitTime =
      Number(
        result.data?.waitTime
      );

    setWaitTime(
      waitTime
    );

    debugLog(
      `待ち時間更新 : ${waitTime}分`
    );

  } catch (error) {

    handleUnexpectedError(
      error
    );

    setWaitTime(null);

  }

}


/* ============================================================================
 * 待ち時間タイマー開始
 * ========================================================================== */

function startWaitTimer() {

  stopWaitTimer();

  updateWaitTime();

  STATE.waitTimer =
    window.setInterval(

      updateWaitTime,

      API.WAITTIME_INTERVAL

    );

  debugLog(
    "待ち時間自動更新開始"
  );

}


/* ============================================================================
 * 待ち時間タイマー停止
 * ========================================================================== */

function stopWaitTimer() {

  if (
    STATE.waitTimer === null
  ) {

    return;

  }

  clearInterval(
    STATE.waitTimer
  );

  STATE.waitTimer =
    null;

  debugLog(
    "待ち時間自動更新停止"
  );

}


/* ============================================================================
 * タブ表示
 * ========================================================================== */

function onPageVisible() {

  startWaitTimer();

}


/* ============================================================================
 * タブ非表示
 * ========================================================================== */

function onPageHidden() {

  stopWaitTimer();

}


/* ============================================================================
 * Visibility Change
 * ========================================================================== */

function onVisibilityChanged() {

  if (
    document.hidden
  ) {

    onPageHidden();

    return;

  }

  onPageVisible();

}


/* ============================================================================
 * 初回待ち時間取得
 * ========================================================================== */

async function initializeWaitTime() {

  setWaitTime(
    null
  );

  await updateWaitTime();

}


/* ============================================================================
 * 待ち時間表示更新
 * ========================================================================== */

function refreshWaitTimeView(minutes) {

  setWaitTime(
    minutes
  );

}


/* ============================================================================
 * 強制待ち時間更新
 * ========================================================================== */

async function refreshWaitTime() {

  await updateWaitTime();

}


/* ============================================================================
 * イベント登録
 * ========================================================================== */

function registerEvents() {

  DOM.startButton.addEventListener(
    "click",
    onStartButtonClick
  );

  DOM.endButton.addEventListener(
    "click",
    onEndButtonClick
  );

  DOM.input.addEventListener(
    "keydown",
    onInputKeyDown
  );

  DOM.input.addEventListener(
    "input",
    onInputChanged
  );

  document.addEventListener(
    "visibilitychange",
    onVisibilityChanged
  );

}


/* ============================================================================
 * アプリケーション初期化
 * ========================================================================== */

async function initializeApplication() {

  try {

    initializeScreen();

    registerEvents();

    await initializeWaitTime();

    startWaitTimer();

    await startScanner();

    debugLog(
      "QueueTime 起動完了"
    );

    setMessage(
      "QRコードを読み取ってください"
    );

  } catch (error) {

    handleUnexpectedError(
      error
    );

  }

}


/* ============================================================================
 * アプリケーション終了処理
 * ========================================================================== */

async function shutdownApplication() {

  try {

    stopWaitTimer();

    if (
      STATE.scanner !== null
    ) {

      try {

        await STATE.scanner.stop();

      } catch (_) {

        /*
         * 既に停止している場合は何もしない
         */

      }

      try {

        await STATE.scanner.clear();

      } catch (_) {

        /*
         * clear失敗も無視
         */

      }

      STATE.scanner =
        null;

    }

    debugLog(
      "QueueTime 終了"
    );

  } catch (error) {

    console.error(
      error
    );

  }

}


/* ============================================================================
 * DOMContentLoaded
 * ========================================================================== */

window.addEventListener(

  "DOMContentLoaded",

  async () => {

    await initializeApplication();

  }

);


/* ============================================================================
 * beforeunload
 * ========================================================================== */

window.addEventListener(

  "beforeunload",

  () => {

    shutdownApplication();

  }

);