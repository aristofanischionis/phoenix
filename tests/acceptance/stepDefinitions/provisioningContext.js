const { client } = require('nightwatch-api')
const { Given, After } = require('cucumber')
require('url-search-params-polyfill')
const httpHelper = require('../helpers/httpHelper')
const backendHelper = require('../helpers/backendHelper')
const userSettings = require('../helpers/userSettings')
const codify = require('../helpers/codify')
const { join } = require('../helpers/path')

function createDefaultUser (userId) {
  const password = userSettings.getPasswordForUser(userId)
  const displayname = userSettings.getDisplayNameOfDefaultUser(userId)
  const email = userSettings.getEmailAddressOfDefaultUser(userId)
  return createUser(userId, password, displayname, email)
}

function createUser (userId, password, displayName = false, email = false) {
  const body = new URLSearchParams()
  body.append('userid', userId)
  body.append('password', password)
  const promiseList = []

  userSettings.addUserToCreatedUsersList(userId, password, displayName, email)
  return httpHelper.requestEndpoint(
    join(
      backendHelper.getCurrentBackendUrl(),
      '/ocs/v2.php/cloud/users?format=json'
    ),
    { method: 'POST', body: body }
  )
    .then(() => {
      if (displayName !== false) {
        promiseList.push(new Promise((resolve, reject) => {
          const body = new URLSearchParams()
          body.append('key', 'display')
          body.append('value', displayName)
          httpHelper.requestEndpoint(
            join(
              backendHelper.getCurrentBackendUrl(),
              `/ocs/v2.php/cloud/users/${encodeURIComponent(userId)}?format=json`
            ),
            { method: 'PUT', body: body }
          )
            .then(res => {
              if (res.status !== 200) {
                reject(new Error('Could not set display name of user'))
              }
              resolve(res)
            })
        }))
      }
    })
    .then(() => {
      if (email !== false) {
        promiseList.push(new Promise((resolve, reject) => {
          const body = new URLSearchParams()
          body.append('key', 'email')
          body.append('value', email)
          httpHelper.requestEndpoint(
            join(
              backendHelper.getCurrentBackendUrl(),
              `/ocs/v2.php/cloud/users/${encodeURIComponent(userId)}?format=json`
            ),
            { method: 'PUT', body: body }
          )
            .then(res => {
              if (res.status !== 200) {
                reject(new Error('Could not set email of user'))
              }
              resolve()
            })
        }))
      }
    })
    .then(() => {
      return Promise.all(promiseList)
    })
}

function deleteUser (userId) {
  userSettings.deleteUserFromCreatedUsersList(userId)
  return httpHelper.requestEndpoint(
    join(
      backendHelper.getCurrentBackendUrl(),
      '/ocs/v2.php/cloud/users/',
      userId
    ),
    { method: 'DELETE' }
  )
}

function initUser (userId) {
  return httpHelper.requestEndpoint(
    join(
      backendHelper.getCurrentBackendUrl(),
      '/ocs/v2.php/cloud/users/',
      userId
    ),
    { method: 'GET' },
    userId
  )
}

/**
 *
 * @param {string} groupId
 * @returns {*|Promise}
 */
function createGroup (groupId) {
  const body = new URLSearchParams()
  body.append('groupid', groupId)
  userSettings.addGroupToCreatedGroupsList(groupId)
  return httpHelper.requestEndpoint(join(client.globals.backend_url, '/ocs/v2.php/cloud/groups?format=json'), {
    method: 'POST',
    body: body
  })
}

/**
 *
 * @param {string} groupId
 * @returns {*|Promise}
 */
function deleteGroup (groupId) {
  userSettings.deleteGroupFromCreatedGroupsList(groupId)
  return httpHelper.requestEndpoint(join(client.globals.backend_url, '/ocs/v2.php/cloud/groups/', groupId),
    { method: 'DELETE' }
  )
}

function addToGroup (userId, groupId) {
  const body = new URLSearchParams()
  body.append('groupid', groupId)

  return httpHelper.requestEndpoint(join(client.globals.backend_url, `/ocs/v2.php/cloud/users/${userId}/groups`),
    { method: 'POST', body: body }
  )
}

Given('user {string} has been created with default attributes', function (userId) {
  return deleteUser(userId)
    .then(() => createDefaultUser(userId))
    .then(() => initUser(userId))
})

Given('user {string} has been created with default attributes on remote server', function (userId) {
  return backendHelper.runOnRemoteBackend(
    async function () {
      await deleteUser()
        .then(() => createDefaultUser(userId))
        .then(() => initUser(userId))
    })
})

Given('the quota of user {string} has been set to {string}', function (userId, quota) {
  const body = new URLSearchParams()
  body.append('key', 'quota')
  body.append('value', quota)

  return httpHelper.requestEndpoint(join(client.globals.backend_url, '/ocs/v2.php/cloud/users/', userId),
    { method: 'PUT', body: body }
  )
    .then(res => httpHelper.checkStatus(res, 'Could not set quota.'))
})

Given('these users have been created with default attributes but not initialized:', function (dataTable) {
  return Promise.all(dataTable.rows().map((userId) => {
    return deleteUser(userId)
      .then(() => createDefaultUser(userId))
  }))
})

Given('these users have been created but not initialized:', function (dataTable) {
  codify.replaceInlineTable(dataTable)
  return Promise.all(dataTable.hashes().map((user) => {
    const userId = user.username
    const password = user.password || userSettings.getPasswordForUser(userId)
    const displayName = user.displayname || false
    const email = user.email || false
    return deleteUser(userId)
      .then(() => createUser(userId, password, displayName, email))
  }))
})

Given('these users have been created with default attributes:', function (dataTable) {
  return Promise.all(dataTable.rows().map((user) => {
    const userId = user[0]
    return deleteUser(userId)
      .then(() => createDefaultUser(userId))
      .then(() => initUser(userId))
  }))
})

Given('group {string} has been created', function (groupId) {
  return deleteGroup(groupId.toString())
    .then(() => createGroup(groupId.toString()))
})

Given('these groups have been created:', function (dataTable) {
  return Promise.all(dataTable.rows().map((groupId) => {
    return deleteGroup(groupId.toString())
      .then(() => createGroup(groupId.toString()))
  }))
})

Given('user {string} has been added to group {string}', function (userId, groupId) {
  return addToGroup(userId, groupId)
})

After(async function () {
  const createdUsers = Object.keys(userSettings.getCreatedUsers('LOCAL'))
  const createdRemoteUsers = Object.keys(userSettings.getCreatedUsers('REMOTE'))
  const createdGroups = userSettings.getCreatedGroups()

  await Promise.all(
    [...createdUsers.map(deleteUser), ...createdGroups.map(deleteGroup)]
  )

  if (client.globals.remote_backend_url) {
    return backendHelper.runOnRemoteBackend(
      () => Promise.all(createdRemoteUsers.map(deleteUser))
    )
  }
})
