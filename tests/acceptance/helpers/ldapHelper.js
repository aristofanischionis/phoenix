const { client } = require('nightwatch-api')
const ldap = require('ldap')
const { join } = require('./path')
const fs = require('fs-extra')

const userHelper = require('./userSettings')

exports.createClient = function (url) {
  return new Promise((resolve, reject) => {
    const ldapClient = ldap.createClient({
      url: url || client.globals.ldap_url // 'ldap://127.0.0.1'
    })

    ldapClient.bind('cn=admin,dc=owncloud,dc=com', 'admin', err => {
      if (err) {
        reject(err)
      }
    })

    ldapClient.add('ou=TestUsers,dc=owncloud,dc=com', {
      objectclass: ['top', 'organizationalUnit'],
      ou: 'TestUsers'
    }, (err) => {
      if (err) {
        console.log('Users OU already exists.')
      }
      ldapClient.add('ou=TestGroups,dc=owncloud,dc=com', {
        objectclass: ['top', 'organizationalUnit'],
        ou: 'TestGroups'
      }, (err) => {
        if (err) {
          console.log('Groups OU already exists.')
        }
        resolve(ldapClient)
      })
    })
  })
}

exports.createEntry = function (client, dn, entry) {
  return new Promise((resolve, reject) => {
    client.add(dn, entry, function (err) {
      if (err) {
        reject(err)
      }
      console.log('Created LDAP entry')
      resolve()
    })
  })
}

exports.cleanup = function (client) {
  return new Promise((resolve, reject) => {
    client.del('ou=TestGroups,dc=owncloud,dc=com', function (err) {
      if (err) {
        reject(err)
      }
      resolve()
    })
  }).then(() => {
    client.del('ou=TestUsers,dc=owncloud,dc=com', function (err) {
      if (err) {
        Promise.reject(err)
      }
      return Promise.resolve()
    })
  })
}

exports.createUser = function (ldapClient, user, password = null, displayName = null, email = null) {
  password = password || userHelper.getPasswordForUser(user)
  displayName = displayName || userHelper.getDisplayNameForUser(user)
  email = email || userHelper.getEmailAddressForUser(user)
  return exports.createEntry(ldapClient, `uid=${user},ou=TestUsers,dc=owncloud,dc=com`, {
    cn: user.charAt(0).toUpperCase() + user.slice(1),
    sn: user,
    objectclass: ['posixAccount', 'inetOrgPerson'],
    homeDirectory: `/home/openldap/${user}`,
    userPassword: password,
    displayName: displayName,
    mail: email,
    gidNumber: 5000,
    uidNumber: 1
  }).then(err => {
    if (!err) {
      userHelper.addUserToCreatedUsersList(user, password, displayName, email)
      const skelDir = process.env.OCIS_SKELETON_DIR
      const dataDir = join(client.globals.ocis_data_dir, 'data', user, 'files')
      return fs.copy(skelDir, dataDir)
    }
    return Promise.reject(new Error('Could not create user on LDAP backend!'))
  })
}

exports.createGroup = function (client, group, members = []) {
  const entry = {
    cn: group,
    objectclass: ['posixGroup', 'top'],
    gidNumber: 500
  }
  if (members.length > 0) {
    entry.memberuid = members
  }
  return exports.createEntry(client, `cn=${group},ou=TestGroups,dc=owncloud,dc=com`, entry)
}

exports.deleteGroup = function (client, group) {
  return new Promise((resolve, reject) => {
    client.del(`cn=${group},ou=TestGroups,dc=owncloud,dc=com`, function (err) {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

exports.deleteUser = function (client, user) {
  return new Promise((resolve, reject) => {
    client.del(`uid=${user},ou=TestUsers,dc=owncloud,dc=com`, function (err) {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

exports.terminate = function (ldapClient) {
  return new Promise((resolve) => {
    if (!ldapClient) {
      resolve()
    }
    ldapClient.unbind(err => {
      !err || console.log(err)
    })
    ldapClient.destroy(err => {
      !err || console.log(err)
    })
    resolve()
  })
}

exports.addUserToGroup = function (client, user, group) {
  return new Promise((resolve, reject) => {
    const groupCn = `cn=${group},ou=TestGroups,dc=owncloud,dc=com`
    client.search(
      groupCn,
      { attributes: [] },
      (err, res) => {
        if (err) reject(err)
        res.on('searchEntry', function (entry) {
          var memberUid
          if (entry.object.memberUid) {
            if (
              entry.object.memberUid === user ||
              (Array.isArray(entry.object.memberUid) &&
                entry.object.memberuid.includes(user))
            ) {
              resolve()
            } else if (Array.isArray(entry.object.memberUid)) {
              memberUid = entry.object.memberUid.concat(user)
            } else {
              memberUid = [user, entry.object.memberUid]
            }
          } else {
            memberUid = user
          }
          const change = new ldap.Change({
            operation: 'replace',
            modification: {
              memberUid
            }
          })
          client.modify(groupCn, change, function (err) {
            if (err) reject(err)
          })
        })
        res.on('error', function (err) {
          reject(err)
        })
        res.on('end', function (result) {
          resolve()
        })
      })
  })
}
