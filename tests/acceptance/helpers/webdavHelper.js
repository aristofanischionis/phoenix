const { client } = require('nightwatch-api')
const httpHelper = require('../helpers/httpHelper')
const backendHelper = require('./backendHelper')
const convert = require('xml-js')
const _ = require('lodash/object')
const { normalize, join, filename } = require('../helpers/path')
const occHelper = require('../helpers/occHelper')

/**
 *
 * @param {string} userId
 * @param {string} element
 * @param {string} server - (REMOTE/LOCAL) server to use for dav path
 */
exports.createDavPath = function (userId, element) {
  const replaceEncoded = encodeURIComponent(element).replace(/%2F/g, '/')
  return join(backendHelper.getCurrentBackendUrl(), '/remote.php/dav/files/', userId, replaceEncoded)
}

/**
 *
 * @param {string} userId
 * @param {string} file
 */
exports.download = function (userId, file) {
  const davPath = exports.createDavPath(userId, file)
  return httpHelper.get(
    davPath,
    {},
    userId
  )
    .then(res => httpHelper.checkStatus(res, 'Could not download file.'))
    .then(res => res.text())
}

/**
 *
 * @param {string} userId
 * @param {string} file
 */
exports.delete = function (userId, file) {
  const davPath = exports.createDavPath(userId, file)
  return httpHelper.delete(
    davPath,
    {},
    userId
  )
    .then(res => httpHelper.checkStatus(res, 'Could not delete file ' + file))
    .then(res => res.text())
}

/**
 * Rename a file using webDAV api.
 *
 * @param {string} userId
 * @param {string} fromName
 * @param {string} toName
 */
exports.move = function (userId, fromName, toName) {
  const davPath = exports.createDavPath(userId, fromName)
  return httpHelper.move(
    davPath,
    {},
    userId,
    { Destination: exports.createDavPath(userId, toName) }
  )
    .then(res => httpHelper.checkStatus(res, 'Could not move file.'))
    .then(res => res.text())
}

/**
 *
 * @param {string} path
 * @param {string} userId
 * @param {array} properties
 * @param {number} folderDepth
 */
exports.propfind = function (path, userId, properties, folderDepth = 1) {
  const davPath = join(backendHelper.getCurrentBackendUrl(), '/remote.php/dav', path)
  let propertyBody = ''
  properties.map(prop => {
    propertyBody += `<${prop}/>`
  })
  const body = `<?xml version="1.0"?>
                <d:propfind
                xmlns:d="DAV:"
                xmlns:oc="http://owncloud.org/ns"
                xmlns:ocs="http://open-collaboration-services.org/ns">
                <d:prop>${propertyBody}</d:prop>
                </d:propfind>`
  return httpHelper.propfind(
    davPath,
    { body },
    userId,
    { Depth: folderDepth }
  )
    .then(res => res.text())
}

/**
 * Get the list of trashbin items for a user
 * in following format
 * [{
 *  "href":
 *  "originalFilename":
 *  "originalLocation":
 *  "deleteTimestamp":
 *  "lastModified":
 * },...]
 *
 * @param {string} user
 */
exports.getTrashBinElements = function (user, depth = 2) {
  return new Promise((resolve) => {
    exports.propfind(`/trash-bin/${user}`, user,
      [
        'oc:trashbin-original-filename',
        'oc:trashbin-original-location',
        'oc:trashbin-delete-timestamp',
        'd:getlastmodified'
      ], depth)
      .then(str => {
        const trashData = convert.xml2js(str, { compact: true })['d:multistatus']['d:response']
        const trashItems = []
        trashData.map(trash => {
          trashItems.push({
            href: trash['d:href']._text,
            originalFilename: trash['d:propstat']['d:prop']['oc:trashbin-original-filename']._text,
            originalLocation: trash['d:propstat']['d:prop']['oc:trashbin-original-location']._text,
            deleteTimestamp: trash['d:propstat']['d:prop']['oc:trashbin-delete-timestamp']._text,
            lastModified: trash['d:propstat']['d:prop']['d:getlastmodified']._text
          })
        })
        resolve(trashItems)
      })
  })
}
/**
 * Create a folder using webDAV api.
 *
 * @param {string} user
 * @param {string} folderName
 */
exports.createFolder = function (user, folderName) {
  const davPath = exports.createDavPath(user, folderName)
  return httpHelper.mkcol(davPath, {}, user)
    .then(res => httpHelper.checkStatus(res, `Could not create the folder "${folderName}" for user "${user}".`))
    .then(res => res.text())
}
/**
 * Create a file using webDAV api.
 *
 * @param {string} user
 * @param {string} fileName
 * @param {string} contents
 */
exports.createFile = function (user, fileName, contents = '') {
  const davPath = exports.createDavPath(user, fileName)
  return httpHelper.put(davPath, { body: contents }, user)
    .then(res => httpHelper.checkStatus(res, `Could not create the file "${fileName}" for user "${user}".`))
    .then(res => res.text())
}

/**
 * Get file or folder properties using webDAV api.
 *
 * @param {string} path
 * @param {string} userId
 * @param {array} requestedProps
*/
exports.getProperties = function (path, userId, requestedProps) {
  return new Promise((resolve, reject) => {
    const trimmedPath = normalize(path) // remove a leading slash
    const relativePath = `/files/${userId}/${trimmedPath}`
    exports.propfind(relativePath, userId, requestedProps,
      0)
      .then(str => {
        const response = JSON.parse(convert.xml2json(str, { compact: true }))
        const receivedProps = _.get(
          response,
          "['d:multistatus']['d:response']['d:propstat']['d:prop']"
        )
        if (receivedProps === undefined) {
          const errMsg = "Could not find 'd:prop' inside response. Received:\n"
          return reject(new Error(errMsg + JSON.stringify(str)))
        }
        const properties = {}
        requestedProps.map(propertyName => {
          properties[propertyName] = receivedProps[propertyName]._text
        })
        return resolve(properties)
      })
  })
}

exports.getSkeletonFile = function (filename) {
  return occHelper.runOcc(['config:system:get', 'skeletondirectory'])
    .then(resp => resp.ocs.data.stdOut)
    .then(dir => {
      const element = join(dir.trim(), filename)
      const apiURL = join(client.globals.backend_url,
        '/ocs/v2.php/apps/testing/api/v1/file',
        `?file=${encodeURIComponent(element)}&absolute=true&format=json`
      )
      return httpHelper.get(apiURL, { method: 'GET' })
    })
    .then(res => res.json())
    .then(body => {
      return decodeURIComponent(body.ocs.data[0].contentUrlEncoded)
    })
}

exports.uploadFileWithContent = function (user, content, filename) {
  const apiURL = join(backendHelper.getCurrentBackendUrl(), '/remote.php/webdav/', filename)
  return httpHelper.put(apiURL,
    { body: content },
    user,
    { 'Content-Type': 'text/plain' }
  )
    .then(res => httpHelper.checkStatus(res, 'Could not upload file' + filename + 'with content' + content))
}

exports.getFavouritedResources = function (user) {
  const body = `<oc:filter-files  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
                 <d:prop><d:resourcetype /></d:prop>
                 <oc:filter-rules>
                     <oc:favorite>1</oc:favorite>
                 </oc:filter-rules>
                </oc:filter-files>`
  return httpHelper.report(client.globals.backend_url + `/remote.php/dav/files/${user}`,
    { body },
    user)
    .then(res => res.text())
    .then(res => {
      const favData = convert.xml2js(res, { compact: true })['d:multistatus']['d:response']
      const favItems = []
      favData.map(favourite => {
        favItems.push({
          resource: filename(favourite['d:href']._text),
          isFolder: !(Object.keys(favourite['d:propstat']['d:prop']['d:resourcetype']).length === 0)
        })
      })
      return favItems
    })
}
