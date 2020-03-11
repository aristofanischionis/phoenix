<template>
  <iframe id="slides" ref="slides" :src="iframeSource"></iframe>
</template>
<script>
import { mapGetters, mapActions } from 'vuex'
// import queryString from 'query-string'

export default {
  name: 'Slides',
  data: () => ({
    filePath: '',
    currentETag: null
  }),
  computed: {
    ...mapGetters(['getToken']),
    loading () {
      return this.content === ''
    },
    iframeSource () {
      // const query = queryString.stringify({
      //   // embed: 1,
      //   // picker: 0,
      //   // stealth: 1,
      //   // spin: 1,
      //   // proto: 'json',
      //   // ui: 'minimal'
      //   // username:,
      // })

      // return 'https://slides.web.cern.ch?' + query
      return 'http://localhost:3000' // how can i get the username ?
    }
  },
  created () {
    this.filePath = this.$route.params.filePath

    window.addEventListener('message', event => {
      console.log('Phoenix event is', event)
      // if (event.origin !== 'http://localhost:3000') return // maybe in the future we can enable this for more security
      // if (event.data.length > 0) {
      // const payload = JSON.parse(event.data)
      const _event = event.data.get('event')
      const payload = event.data.get('slidesFile')
      if (_event === 'init') {
        this.load()
      } else if (_event === 'save') {
        this.save(payload)
      } else if (_event === 'exit') {
        this.exit()
      }
      // }
    })
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

    load () {
      this.$client.files.getFileContents(this.filePath, { resolveWithResponseObject: true })
        .then(resp => {
          this.currentETag = resp.headers.ETag
          this.$refs.slides.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            slidesFile: resp.body
          }), '*')
        })
        .catch(error => {
          this.error(error)
        })
    },
    save (payload) {
      console.log('im in save with payload', payload)
      // i have to fix it how to save it, i got the state but i need the pictures as well and then also how to save it
      this.$client.files.putFileContents(this.filePath, payload, {
        previousEntityTag: this.currentETag, contentType: 'multipart/form-data; boundary='
      }).then((resp) => {
        console.log('eimai sthn save success')
        this.$refs.slides.contentWindow.postMessage(JSON.stringify({
          action: 'Successfully Saved'
        }), '*')
        this.currentETag = resp.ETag
      }).catch(error => {
        console.log('eimai sthn save error')
        this.error(error)
      })
    },
    exit () {
      window.close()
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
