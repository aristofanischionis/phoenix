<template>
  <iframe id="slides" ref="slides" :src="iframeSource"></iframe>
</template>
<script>

import { mapGetters, mapActions } from 'vuex'
import Store from '../../../src/store'
import queryString from 'query-string'
import axios from 'axios'

// example for my Slides app:
// Integration just have to find the token and inode and send them as parameters to slides
/* getFileInfo
http://localhost:8443/wopi/files/--inode--?access_token=--token--
*/
/* getFileContents
http://localhost:8443/wopi/files/--inode--/contents?access_token=--token--
*/

export default {
  name: 'Slides',
  data: () => ({
    filePath: '',
    accessToken: '', // access token which should be given as params, with name --> access_token
    inode: '', // number indicating the file
    username: '',
    response: ''
  }),
  computed: {
    ...mapGetters(['getToken']),
    loading () {
      return this.content === ''
    },
    iframeSource () {
      const query = queryString.stringify({
        username: this.username,
        wopiSrc: this.wopiSrc,
        accessToken: this.accessToken
      })
      // return 'https://slides.web.cern.ch?' + query
      // first OPEN in WOPI, get a token and pass it as parameter and username in SLIDES
      // export that to function

      // GET GETFILEINFO GETFILE LOCK file in the Slides side
      // PUTFILE UNLOCK file Slides side
      // notifications in SLIDES side
      // then forget about it
      return 'http://localhost:3000'
    }
  },
  mounted () {
    this.openWOPI()
  },
  methods: {
    ...mapActions(['showMessage']),
    error (error) {
      this.showMessage({
        title: this.$gettext('File could not be loaded…'),
        desc: error,
        status: 'danger'
      })
    },
    openWOPI: function () {
      axios
        .get('http://localhost:8443/wopi/cbox/open', {
          params: {
            ruid: 1,
            rgid: 1,
            canedit: true,
            username: Store.state.user.id,
            filename: this.$route.params.filePath,
            folderurl: '/'
          }
        }).then(response => {
          console.log('response________', response)
          // should get the wopisrc and the accesstoken
          this.response = response
        }).catch(e => {
          console.log('errorrrrrrrrrrrrrr', e)
          this.response = null
          this.error(e)
        })
    }
  }
}
</script>
<style scoped>
#slides {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;
  border: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  z-index: 999999;
}
</style>
