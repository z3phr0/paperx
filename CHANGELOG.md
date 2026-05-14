## [0.11.5](https://github.com/z3phr0/paperx/compare/v0.11.4...v0.11.5) (2026-05-14)
## [0.11.4](https://github.com/z3phr0/paperx/compare/v0.11.3...v0.11.4) (2026-05-14)


### Bug Fixes

* **design-v2:** Inspect CSS shows computed rules + TW dedups overrides ([4237a31](https://github.com/z3phr0/paperx/commit/4237a31bcbfdfef8b53a3193ea21c4823e0e8f39))
## [0.11.3](https://github.com/z3phr0/paperx/compare/v0.11.2...v0.11.3) (2026-05-14)


### Bug Fixes

* **design-v2:** Fill auto-detects stylesheet-driven background colors ([edf4545](https://github.com/z3phr0/paperx/commit/edf45458ac0dde017a1c89b92587c2f327ab3a57))


### Features

* **design-v2:** Inspect CodeBlock mirrors the real DOM class + style ([b34a909](https://github.com/z3phr0/paperx/commit/b34a9091e89f5b5adc40a7e315123649022c2c52))
## [0.11.2](https://github.com/z3phr0/paperx/compare/v0.11.1...v0.11.2) (2026-05-14)


### Bug Fixes

* **ui-v2:** forwardRef IconButton so asChild slots can attach refs ([4f1781e](https://github.com/z3phr0/paperx/commit/4f1781e0836a8d896b28d98c5249c1186a4cce93))
## [0.11.1](https://github.com/z3phr0/paperx/compare/v0.11.0...v0.11.1) (2026-05-14)


### Features

* **color-picker:** v2 trigger left-aligns hex + alpha cluster ([9d81594](https://github.com/z3phr0/paperx/commit/9d81594cc20bf300e37c0ae3d1bff9c8920922b5))
* **design-v2:** Border style switcher uses fixed icon trigger ([89e1c36](https://github.com/z3phr0/paperx/commit/89e1c3663648be59d1612a2dffac7887fd69d311))
* **design-v2:** Fill section commits background-color via useFillEditor ([0d5723f](https://github.com/z3phr0/paperx/commit/0d5723fff7a353c289db1171859b643bea262537))
# [0.11.0](https://github.com/z3phr0/paperx/compare/v0.10.3...v0.11.0) (2026-05-13)


### Features

* **design-v2:** DesignPanel auto-positions next to the selected element ([b4f69a7](https://github.com/z3phr0/paperx/commit/b4f69a7c4cc665561f4bccfc62944d4ed77bdc7b))
* **stores:** toolbarPosition with sessionStorage rehydration ([6ec208c](https://github.com/z3phr0/paperx/commit/6ec208ce92b5bbabc5a22b35b1db122d43a05a2f))
* **toolbar:** drag handle with pointer capture + viewport clamp ([525b60a](https://github.com/z3phr0/paperx/commit/525b60a90a2dc14db7908a8a62d694970d3a6a8f))
* **utils:** pickPanelPosition strategy + shared hover-tooltip rect ([40bd658](https://github.com/z3phr0/paperx/commit/40bd65884b6d7adb45267c6967936c11f3c50ca6))
## [0.10.3](https://github.com/z3phr0/paperx/compare/v0.10.2...v0.10.3) (2026-05-13)


### Bug Fixes

* **design-v2:** hoist dark-theme tokens to :host so portaled overlays resolve them ([fa08c71](https://github.com/z3phr0/paperx/commit/fa08c714bb24a0893ab4fe12c1e2797e5cd3d249)), closes [#2c2c2e](https://github.com/z3phr0/paperx/issues/2c2c2e) [#paperx-portal-layer](https://github.com/z3phr0/paperx/issues/paperx-portal-layer)
## [0.10.2](https://github.com/z3phr0/paperx/compare/v0.10.1...v0.10.2) (2026-05-13)


### Features

* **design-v2:** Dropdown active state on trigger + opaque popup bg ([b920715](https://github.com/z3phr0/paperx/commit/b9207153350facc30edf5afb8d8a3c2059be12f8)), closes [#2c2c2e](https://github.com/z3phr0/paperx/issues/2c2c2e)
## [0.10.1](https://github.com/z3phr0/paperx/compare/v0.10.0...v0.10.1) (2026-05-13)


### Features

* **color-picker:** v2-aligned trigger using dv-row tokens, share Swatch primitive ([f70b60b](https://github.com/z3phr0/paperx/commit/f70b60b186293b472a3ecc5bc7458a278e6842d7))
* **design-v2:** Border opts into the v2 ColorPicker trigger ([eb0ff6f](https://github.com/z3phr0/paperx/commit/eb0ff6f7b85afc9f0af907b2db5b9b1e60f6e534))
# [0.10.0](https://github.com/z3phr0/paperx/compare/v0.9.0...v0.10.0) (2026-05-13)


### Features

* **overlays:** render nearest-edge distance per visBug semantics ([f62b9b8](https://github.com/z3phr0/paperx/commit/f62b9b8547173b09c7d6b02eeefa1e191f8ea751))
# [0.9.0](https://github.com/z3phr0/paperx/compare/v0.8.1...v0.9.0) (2026-05-13)


### Bug Fixes

* **design-v2:** 2px gap between dropdown items; flush last item ([59c3de5](https://github.com/z3phr0/paperx/commit/59c3de5f06017a511012ea0d277e6ab28e026ec9))
* **design-v2:** clear toolbar pill + cap inspector height at 800px ([b530e0f](https://github.com/z3phr0/paperx/commit/b530e0f69ddb4b409bda92d9954398ca804a3b8c))
* **design-v2:** drop the prefix icon on the Border side dropdown ([6ca15e4](https://github.com/z3phr0/paperx/commit/6ca15e44d0076a85f524b85a9580e3f389b99164))
* **design-v2:** dropdown item rhythm + icon center + readable popup bg ([719681e](https://github.com/z3phr0/paperx/commit/719681eff37a1e6c70126b3a99dec86665455c61))
* **design-v2:** label stack + arrow nudge + silent border empty state ([bc5cd20](https://github.com/z3phr0/paperx/commit/bc5cd20bff931390d811a9abd523921ca854c5f0)), closes [paperx-inspector.jsx#DesignSub](https://github.com/paperx-inspector.jsx/issues/DesignSub)
* **design-v2:** make dropdown hover visible; drop tab hover background ([cf65e09](https://github.com/z3phr0/paperx/commit/cf65e095296f6560e5c905b4bae959e349d6c2e3))
* **design-v2:** overlay scrollbar so the panel keeps its inner width ([73f3796](https://github.com/z3phr0/paperx/commit/73f37966cc8128385ee22c2a1f4f9c123fe9d8f7))
* **design-v2:** popup bg uses the input recipe verbatim ([9626bad](https://github.com/z3phr0/paperx/commit/9626badcca321524876d1b11e02be58111bbe425))
* **design-v2:** position stack, collapsed sections, dropdown hover, flat active tab ([53e4e68](https://github.com/z3phr0/paperx/commit/53e4e685eac28f6724e08a13419c5535f029b385))
* **design-v2:** trim section padding-top to balance optical rhythm ([9d79878](https://github.com/z3phr0/paperx/commit/9d7987860d7b087c47071220294e3b4b0814ba4f))


### Features

* **design-v2:** Border/Radius sections + Inspect sub-tab; wire toolbar ([3cd19b3](https://github.com/z3phr0/paperx/commit/3cd19b35b03753a2e9dd85f27d7b3076b7e59154))
* **design-v2:** inspector shell + Frame/Appearance/Fill sections ([f97cee9](https://github.com/z3phr0/paperx/commit/f97cee9803ccb4ba9b7871fb0b8b4b6d2f92eb9e))
* **design-v2:** ruler mode now renders the V2 Inspect view ([1cadf91](https://github.com/z3phr0/paperx/commit/1cadf91b01bddd03b8095c7613b1e34b8b0773a1))
* **styles:** design-v2 token sheet injected into shadow root ([c9896cd](https://github.com/z3phr0/paperx/commit/c9896cd512b405f78c97ac9cb5ce1fcc3293896d)), closes [#D09A06](https://github.com/z3phr0/paperx/issues/D09A06)
* **ui-v2:** atomic component set for design-v2 inspector ([32c3f87](https://github.com/z3phr0/paperx/commit/32c3f87609fd83484de3bc2ae90362c9470fb475))
## [0.8.1](https://github.com/z3phr0/paperx/compare/v0.8.0...v0.8.1) (2026-05-12)
# [0.8.0](https://github.com/z3phr0/paperx/compare/v0.7.1...v0.8.0) (2026-05-12)


### Features

* **overlays:** figma-style hover guides + distance labels ([4f1eafe](https://github.com/z3phr0/paperx/commit/4f1eafe36e2a55a1baa010e8a3dcd1d7c2203b33)), closes [#F24E1E](https://github.com/z3phr0/paperx/issues/F24E1E) [#FFFFFF](https://github.com/z3phr0/paperx/issues/FFFFFF) [#1F2937](https://github.com/z3phr0/paperx/issues/1F2937) [#E5E7EB](https://github.com/z3phr0/paperx/issues/E5E7EB)
## [0.7.1](https://github.com/z3phr0/paperx/compare/v0.7.0...v0.7.1) (2026-05-12)


### Performance Improvements

* **popup:** direct chrome.storage.session reads + optimistic render ([19f5a09](https://github.com/z3phr0/paperx/commit/19f5a0973809659d26a1ad05306a02764f2233d8))
# [0.7.0](https://github.com/z3phr0/paperx/compare/v0.6.1...v0.7.0) (2026-05-12)


### Features

* **toolbar:** clicking active mode deselects (mode = null) ([d7f32eb](https://github.com/z3phr0/paperx/commit/d7f32ebfafbd289dac771a735cc71d5808914f1e))
* **uistore:** nullable mode + toggleMode action ([d802d2f](https://github.com/z3phr0/paperx/commit/d802d2ff8a074128cdc98b091215e3b240fb1c87))
## [0.6.1](https://github.com/z3phr0/paperx/compare/v0.6.0...v0.6.1) (2026-05-12)


### Bug Fixes

* **layout:** rename Stack → Flex + replace align icons with lucide ([af8cd6a](https://github.com/z3phr0/paperx/commit/af8cd6a35f0616d2ac3c9da7964fe41774001d57))
# [0.6.0](https://github.com/z3phr0/paperx/compare/v0.5.2...v0.6.0) (2026-05-12)


### Features

* **design:** add Layout section (Stack/Grid Framer-style) ([8915286](https://github.com/z3phr0/paperx/commit/8915286ca7f3c74735819947a24043a4ab069356))
* **design:** rename Effects → Radius + enable-on-add empty state ([0cf906a](https://github.com/z3phr0/paperx/commit/0cf906a14c501dd36fed5f6d9ba3827d5b533260))
## [0.5.2](https://github.com/z3phr0/paperx/compare/v0.5.1...v0.5.2) (2026-05-12)


### Features

* **color-picker:** integrated trigger pill + always-on presets + readable fields ([cba32f0](https://github.com/z3phr0/paperx/commit/cba32f020fd2fae859bd9cafb130874c67f9261b))
## [0.5.1](https://github.com/z3phr0/paperx/compare/v0.5.0...v0.5.1) (2026-05-11)


### Bug Fixes

* **border:** derive entries from target inline style (collapse + switch) ([de5db15](https://github.com/z3phr0/paperx/commit/de5db15fc4f0862da3628169569cbe13fec25085))
# [0.5.0](https://github.com/z3phr0/paperx/compare/v0.4.0...v0.5.0) (2026-05-11)


### Features

* **border:** multi-row editor + pointer-events fix for ColorPicker ([9cffef4](https://github.com/z3phr0/paperx/commit/9cffef4a35565d153bc6867c3c6ad53a4742154c))
# [0.4.0](https://github.com/z3phr0/paperx/compare/v0.3.0...v0.4.0) (2026-05-11)


### Features

* **effects:** dual-mode radius — unified Slider vs per-corner inputs ([f83a82e](https://github.com/z3phr0/paperx/commit/f83a82e1d9d764cb3a8738ad2443d01bb30e8ee8))
# [0.3.0](https://github.com/z3phr0/paperx/compare/v0.2.3...v0.3.0) (2026-05-11)


### Features

* **popup:** global ON/OFF switch via MV3 popup panel ([8cc3883](https://github.com/z3phr0/paperx/commit/8cc38830b05803c926a377dbb01e91b738c054a8))
## [0.2.3](https://github.com/z3phr0/paperx/compare/v0.2.2...v0.2.3) (2026-05-11)
## [0.2.2](https://github.com/z3phr0/paperx/compare/v0.2.1...v0.2.2) (2026-05-08)


### Bug Fixes

* **comment:** unmissable Locate flash + always-visible action buttons ([8081984](https://github.com/z3phr0/paperx/commit/808198453f556f279b9e3c7b26a6b63c68fb8bc6))


### Features

* **comment:** real PNG thumbnails via snapdom + 3 new e2e ([51a3388](https://github.com/z3phr0/paperx/commit/51a338812e6700b6e2bd025bc273479e4f08ccfa))
## [0.2.1](https://github.com/z3phr0/paperx/compare/v0.2.0...v0.2.1) (2026-05-08)


### Features

* **comment:** paperx-comments-v1 + Figma-style guide overlays ([56c1d3b](https://github.com/z3phr0/paperx/commit/56c1d3b6f4a0a448de5c0a16223b4f7db25eaeaf))
* **comment:** priority chip + thumbnail + locate + import/export panel ([b8a3018](https://github.com/z3phr0/paperx/commit/b8a30184079615b5e403dbaa1ff0a76531fc0381))
# 0.2.0 (2026-05-08)


### Bug Fixes

* **layout:** track display in local state for instant re-render ([dc2b907](https://github.com/z3phr0/paperx/commit/dc2b907fa10dcb0e7f4b919a66613d7a57691ad0))


### Features

* **content:** ChangeLog drawer + toolbar History button (S2-A 3/3) ([e977966](https://github.com/z3phr0/paperx/commit/e97796627a9abd82cd03b6d4cca5577117e00c87))
* **content:** data-testid hooks for e2e selectors (S3-A 2/3) ([006ab8d](https://github.com/z3phr0/paperx/commit/006ab8da8c1cceca2bf3639ce480e89c2aef0e70))
* **content:** design-mode ElementPicker + DesignPanel (Phase 2 P0-2) ([491e6c2](https://github.com/z3phr0/paperx/commit/491e6c29f249d10cce834cad3b2e60a9e07ef53d))
* **content:** Shadow DOM bootstrap + shadcn-style FloatingToolbar MVP ([150a946](https://github.com/z3phr0/paperx/commit/150a94658cebb5cfdc69b20ec0aa1be2b2aa2ac6))
* **design:** add Background section with solid/gradient/image modes ([e197fcf](https://github.com/z3phr0/paperx/commit/e197fcfd6d9763c971e28a4a0f81f5a297e56d8e))
* **design:** add Border section (width / style / color, all sides) ([44c246a](https://github.com/z3phr0/paperx/commit/44c246a37212fe7b7f8296446ad5ebdca43fc528))
* **design:** add Effects (border-radius corners) + wire new sections ([0b88057](https://github.com/z3phr0/paperx/commit/0b88057d7b63f8b01af67edba2ce85bdb83ef045))
* **design:** box-model section ([b35d56e](https://github.com/z3phr0/paperx/commit/b35d56e78c41c1a7066338ead14fda7d72e2b132))
* **layout:** flex controls section ([5b02aba](https://github.com/z3phr0/paperx/commit/5b02abab76fc82ae45aa809bc099089b37aa4614))
* **layout:** grid controls section ([6c96926](https://github.com/z3phr0/paperx/commit/6c96926efe841ac93fda5c96c64e7c41b7d2f293))
* **modes:** widen ToolMode with 'transition' placeholder ([dbe0d38](https://github.com/z3phr0/paperx/commit/dbe0d38be70fe02e8fbcf2e6143aca60594bd560))
* **overlays:** 8 resize handles in design mode (Phase 3 / P3-D) ([8352228](https://github.com/z3phr0/paperx/commit/835222856b80067fd99e6d96745cf387848c2e6f)), closes [commit-throu#baseline-restore](https://github.com/commit-throu/issues/baseline-restore)
* **overlays:** hover tooltip — visBug-style mini info card (Phase 3 / P3-A) ([096ecd9](https://github.com/z3phr0/paperx/commit/096ecd9144b527081052e996ad348b8f62925152))
* **overlays:** rotate handle in design mode (Phase 3 / P3-E) ([8d77abc](https://github.com/z3phr0/paperx/commit/8d77abc1a1a334e8211a4908d0a4a6668b757543)), closes [commit-throu#baseline-restore](https://github.com/commit-throu/issues/baseline-restore)
* **overlays:** viewport rulers in ruler mode (Phase 3 / P3-B) ([68a50ff](https://github.com/z3phr0/paperx/commit/68a50ff2409dcc01fb5c92164f15cd799aee9daf))
* **panels/changelog:** ChangeRow + FilterBar spec aliases (S2-A wrap) ([ff13355](https://github.com/z3phr0/paperx/commit/ff133553ba3458df07c503a4680005675370ab35))
* **panels/design:** wire ColorPicker into Typography color field (S2-C 2/2) ([841b848](https://github.com/z3phr0/paperx/commit/841b848d36d9dca88ee58ef80a5484cfbf947555))
* **panels:** add TransitionPanel with property/duration/delay/bezier ([442ce8e](https://github.com/z3phr0/paperx/commit/442ce8e3a45b05c561d1df258d29409247bed5ce))
* **panels:** apply paperx-surface utility to overlay roots ([40ec606](https://github.com/z3phr0/paperx/commit/40ec606171ee120692162bbb0966c8a2fa9c1d16))
* **panels:** ruler / comment / layout mode skeletons (S3-C) ([4717edd](https://github.com/z3phr0/paperx/commit/4717edd8f7c78d81798b261aeb3ef945b69ed8d8))
* **picker:** activate ElementPicker in all 4 modes (S3-C prep) ([b24835b](https://github.com/z3phr0/paperx/commit/b24835bce625611db1b30a8a71400961899fae2f))
* **shared/services:** JsonPromptExporter — paperx-prompt-v1 builder (S2-A 2/3) ([feeb233](https://github.com/z3phr0/paperx/commit/feeb233ded46595a32055bca502844da6eb24229))
* **shared/ui:** ColorPicker — Radix Popover + react-colorful (S2-C 1/2) ([9fc3ed6](https://github.com/z3phr0/paperx/commit/9fc3ed66ee30e65a175c7872b6b5157d7a687b13))
* **shared/ui:** Input/Label/Select/Card primitives for design panel ([580891e](https://github.com/z3phr0/paperx/commit/580891e04ffe0bce5e4d5be51850a53750998b4d))
* **shared:** JSON Prompt v1 schema + ChangeLogUIStore (S2-A 1/3) ([406c3b0](https://github.com/z3phr0/paperx/commit/406c3b00012db9672497052320a9a4d7a97572e5))
* **shared:** MobX UIStore + Inversify container + ChangeLogService skeleton ([7ce7c71](https://github.com/z3phr0/paperx/commit/7ce7c711bd013e1fe1b98701931b3c298c8a6cdb))
* **shared:** SelectionStore + change target helpers (Phase 2 P0-2) ([39de97b](https://github.com/z3phr0/paperx/commit/39de97be9eb697c3b597d98a4674dbd1c13b9c8d))
* **shared:** StyleEditService — single writer for inline-style edits ([e6c955f](https://github.com/z3phr0/paperx/commit/e6c955f76329176ecf6911aeb0ba098f299f1d8e))
* **snap:** alignment guidelines for resize handles (Phase 3 / P3-C) ([95656f0](https://github.com/z3phr0/paperx/commit/95656f0aaa063092dcb4ad512c30de72c7d0d670)), closes [#ec4899](https://github.com/z3phr0/paperx/issues/ec4899)
* **ui/portal:** PortalProvider + usePortalContainer for shadow DOM ([9fb7676](https://github.com/z3phr0/paperx/commit/9fb76763e027b27c434c7d871ccd00125c6d31ff))
* **ui:** add AlignButtons cluster ([d3ba453](https://github.com/z3phr0/paperx/commit/d3ba453b0174918487676abe4625fd1c2d6c74a2))
* **ui:** add cubic-bezier curve editor primitive ([64a8ef3](https://github.com/z3phr0/paperx/commit/64a8ef3a0edcb724bf3f686472f28e0fff234481))
* **ui:** add GradientEditor primitive with linear+radial drag ([570f763](https://github.com/z3phr0/paperx/commit/570f763fb5fca0ec40683c4f076baddce100092e))
* **ui:** add IconButton primitive ([02647c9](https://github.com/z3phr0/paperx/commit/02647c932585ff480eaee3af9b382141e8dd562c))
* **ui:** add Segmented mode picker ([2d4e762](https://github.com/z3phr0/paperx/commit/2d4e762a7752035627657b3e311861d3c55ec4e6))
* **ui:** add Slider primitive ([ff62512](https://github.com/z3phr0/paperx/commit/ff62512ff7295b29d9650b3090316970752b5ad4))
* **visual:** black frosted-glass tokens + paperx-surface utility ([6d4030f](https://github.com/z3phr0/paperx/commit/6d4030fca7f2ba2d8177bf5a752fa12375f6500f))
* **visual:** flip remaining semantic tokens to dark theme ([e77b338](https://github.com/z3phr0/paperx/commit/e77b3381d39c0a0aeb798ddf1bf36910e39bf7b4))
