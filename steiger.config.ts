import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Young codebase: run-code / lint-code / complete-code features and the widgets
    // are intentionally separate per docs/PLAN.md and will gain references as the
    // milestones land. Import-direction and public-API rules stay fully enforced.
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
