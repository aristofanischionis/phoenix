const userSettings = require('../helpers/userSettings')
const _ = require('lodash')
const fetch = require('node-fetch')

/**
 *
 * @param {string} userId
 *
 * @returns {{Authorization: string}}
 */
exports.createAuthHeader = function (userId) {
  const password = userSettings.getPasswordForUser(userId)
  return {
    Authorization: 'Basic ' +
      Buffer.from(userId + ':' + password).toString('base64')
  }
}
/**
 *
 * @param {string} userId
 *
 * @returns {{<header>: string}}
 */
exports.createOCSRequestHeaders = function (userId) {
  return {
    ...this.createAuthHeader(userId),
    'OCS-APIREQUEST': true
  }
}
/**
 *
 * @param {node-fetch.Response} response
 * @param {string} message
 *
 * @throws Error
 * @returns {node-fetch.Response}
 */
exports.checkStatus = function (response, message) {
  if (response.ok) { // response.status >= 200 && response.status < 300
    return response
  } else {
    throw Error(message + ' Status:' + response.status + ' ' + response.statusText)
  }
}

/**
 *
 * @param {node-fetch.Response} response
 * @param {string} message
 *
 * @throws Error
 * @returns {node-fetch.Response}
 */
exports.checkOCSStatus = function (response, message) {
  const statusCode = _.get(response, 'ocs.meta.statuscode')
  if (statusCode === 200) {
    return response
  } else {
    throw Error(message + ' Status:' + statusCode)
  }
}

/**
 *
 * @param {string} url
 * @param {object} params
 * @param {string} userId
 * @param {object} header
 *
 * @returns {node-fetch}
 */
exports.requestWebdavEndpoint = function (url, params, userId = 'admin', header = {}) {
  const headers = { ...this.createAuthHeader(userId), ...header }
  const options = { ...params, headers }
  return fetch(url, options)
}

/**
 *
 * @param {string} url
 * @param {object} params
 * @param {string} userId
 * @param {object} header
 *
 * @returns {node-fetch}
 */
exports.requestEndpoint = function (url, params, userId = 'admin', header = {}) {
  const headers = { ...this.createOCSRequestHeaders(userId), ...header }
  const options = { ...params, headers }
  return fetch(url, options)
}
