import 'core-js/stable'
import 'regenerator-runtime/runtime'

import Slides from './Slides.vue'

const routes = [{
  name: 'slides-edit',
  path: '/edit/:filePath',
  components: {
    fullscreen: Slides
  },
  meta: { hideHeadbar: true }
}]

const appInfo = {
  name: 'Slides',
  id: 'slides',
  icon: 'text',
  extensions: [{
    extension: 'slides',
    newTab: true,
    routeName: 'slides-edit',
    newFileMenu: {
      menuTitle ($gettext) {
        return $gettext('New presentation with Slides…')
      }
    }
  }]
}

export default define({
  appInfo,
  routes
})
