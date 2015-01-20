$(document).ready(function(){

window.onunhandledrejection = function(reason, promise) {
  console.error(reason)
  throw reason
}

module('StateMachine')

  var stateMachine = {}
  _.extend(stateMachine, Backbone.StateMachine, Backbone.Events, {
    transitions: {
      'init': {
        'initialized': {enterState: 'visible'}
      },
      'visible': {
        'hide': {
          enterState: 'hidden',
          callbacks: ['visibleToHidden1', 'visibleToHidden2']
        }
      },
      'hidden': {
        'show': {
          enterState: 'visible',
          callbacks: ['hiddenToVisible1', 'hiddenToVisible2'],
          triggers: 'showTime'
        }
      },
      '*': { 'panic': 'panicking' }
    },
    states: {
      'visible': {enter: ['enterVisible1', 'enterVisible2'], leave: ['leaveVisible1', 'leaveVisible2']},
      'hidden': {enter: ['enterHidden1']},
    },
    visibleToHidden1: function() {this._saveCb('visibleToHidden1', arguments)},
    visibleToHidden2: function() {this._saveCb('visibleToHidden2', arguments)},
    hiddenToVisible1: function() {this._saveCb('hiddenToVisible1', arguments)},
    hiddenToVisible2: function() {this._saveCb('hiddenToVisible2', arguments)},
    enterVisible1: function() {this._saveCb('enterVisible1', arguments)},
    enterVisible2: function() {this._saveCb('enterVisible2', arguments)},
    leaveVisible1: function() {this._saveCb('leaveVisible1', arguments)},
    leaveVisible2: function() {this._saveCb('leaveVisible2', arguments)},
    enterHidden1: function() {this._saveCb('enterHidden1', arguments)},
    _saveCb: function(name, args) {
      this.cbData.push([name].concat(_.toArray(args)))
    },
    testSetUp: function(initState, connect) {
      this.unbind(null, this.testCb)
      if (connect) this.bind('all', this.testCb, this)
      this.toState(initState)
      this.eventsData = []
      this.cbData = []
      this.silent = false
    },
    testCb: function(){
      this.eventsData.push(_.toArray(arguments))
    },
    cbData: [],
    eventsData: []
  })

  stateMachine.startStateMachine({currentState: 'hidden'})

  test('StateMachine - throws error if startStateMachine called twice', function() {
    raises(function() { stateMachine.startStateMachine({currentState: 'hidden'}) })
  })

  test('StateMachine - getMachineEvents', function () {
    deepEqual(stateMachine.getMachineEvents(), ['initialized', 'hide', 'show', 'panic'])
  })

  asyncTest('StateMachine - transition events and arguments', function () {
    stateMachine.testSetUp('visible', true)
    stateMachine.trigger('hide', 'behind a tree')
    Promise.delay(0).then(function() {
      equal(stateMachine.currentState, 'hidden')
      deepEqual(stateMachine.eventsData, [
        ['hide', 'behind a tree'],                          // the initial trigger
        ['leaveState:visible', 'behind a tree'],
        ['transition', 'visible', 'hidden', 'behind a tree'],
        ['enterState:hidden', 'behind a tree']
      ])
    }).finally(QUnit.start)
  })

  asyncTest("StateMachine - transition's 'triggers' option", function () {
    stateMachine.testSetUp('hidden', true)
    stateMachine.trigger('show', 'shamelessly', 'your', 'feet')
    Promise.delay(0).then(function() {
      equal(stateMachine.currentState, 'visible')
      deepEqual(stateMachine.eventsData, [
        ['show', 'shamelessly', 'your', 'feet'],             // the initial trigger
        ['leaveState:hidden', 'shamelessly', 'your', 'feet'],
        ['transition', 'hidden', 'visible', 'shamelessly', 'your', 'feet'],
        ['showTime', 'shamelessly', 'your', 'feet'],
        ['enterState:visible', 'shamelessly', 'your', 'feet']
      ])
    }).finally(QUnit.start)
  })

  asyncTest('StateMachine - transition callbacks and arguments', function () {
    stateMachine.testSetUp('visible')
    stateMachine.trigger('hide', 'under your bed')
    Promise.delay(0).then(function() {
      equal(stateMachine.currentState, 'hidden')
      deepEqual(stateMachine.cbData, [
        ['leaveVisible1', 'under your bed'],
        ['leaveVisible2', 'under your bed'],
        ['visibleToHidden1', 'under your bed'],
        ['visibleToHidden2', 'under your bed'],
        ['enterHidden1', 'under your bed']
      ])
    }).finally(QUnit.start)
  })

  asyncTest('StateMachine - declaring transition with a wildcard', function () {
    stateMachine.testSetUp('visible')
    stateMachine.trigger('panic')
    Promise.delay(0).then(function() {
      equal(stateMachine.currentState, 'panicking')
    }).finally(QUnit.start)
  })

  test('StateMachine - toState', function () {
    stateMachine.testSetUp('visible')
    stateMachine.toState('hidden', 'in the box')
    equal(stateMachine.currentState, 'hidden')
    deepEqual(stateMachine.cbData, [
      ['enterHidden1', 'in the box']
    ])
  })

  asyncTest('StateMachine - no transition', function () {
    stateMachine.testSetUp('hidden', true)
    stateMachine.trigger('hide')
    Promise.delay(0).then(function() {
      equal(stateMachine.currentState, 'hidden')
      deepEqual(stateMachine.eventsData, [
        ['hide']                                            // the initial trigger
      ])
      deepEqual(stateMachine.cbData, [])
    }).finally(QUnit.start)
  })

  asyncTest('StateMachine - trigger silent', function () {
    stateMachine.testSetUp('hidden', true)
    stateMachine.silent = true
    stateMachine.trigger('show', 'bla')
    Promise.delay(0).then(function() {
      equal(stateMachine.currentState, 'visible')
      deepEqual(stateMachine.eventsData, [
        ['show', 'bla']                                     // the initial trigger
      ])
      deepEqual(stateMachine.cbData, [
        ['hiddenToVisible1', 'bla'],
        ['hiddenToVisible2', 'bla'],
        ['enterVisible1', 'bla'],
        ['enterVisible2', 'bla']
      ])
    }).finally(QUnit.start)
  })

  asyncTest('StateMachine - enter callback can trigger other transitions', function () {
    var stateMachine = _.extend({}, Backbone.StateMachine, Backbone.Events, {
      transitions: {
        'init': { 'show': 'visible' },
        'visible': { 'hide': 'hidden' }
      },
      states: { 'visible': {enter: ['hideNow']} },
      hideNow: function() { this.trigger('hide') }
    })
    var allTransitions = []
    stateMachine.startStateMachine()

    stateMachine.on('transition', function(leave, enter) {
      allTransitions.push([leave, enter])
    })
    stateMachine.trigger('show')
    Promise.delay(0).then(function() {
      deepEqual(allTransitions, [['init', 'visible'], ['visible', 'hidden']])
    }).finally(QUnit.start)
  })

  asyncTest('StateMachine - triggerAsync returns a promise of transition callbacks', function () {
    var resolve;

    var stateMachine = _.extend({}, Backbone.StateMachine, Backbone.Events, {
      transitions: {
        init: { 'show': 'promisedShow' }
      },
      states: {
        init: {},
        promisedShow: {enter: ['promisedShow']}
      },
      promisedShow: function() {
        return new Promise(function(res, rej) { resolve = res; });
      }
    })
    stateMachine.startStateMachine()

    var resolved = false;
    stateMachine.triggerAsync('show').then(function() {
      resolved = true
    })

    Promise.delay(0).then(function() {
      equal(resolved, false)
      resolve()
      return Promise.delay(0)
    }).then(function() {
      equal(resolved, true)
    }).finally(QUnit.start);
  });

  asyncTest('StateMachine - triggerAsync should wait for the previous transition to finish', function () {
    var showResolve, hideResolve;

    var stateMachine = _.extend({}, Backbone.StateMachine, Backbone.Events, {
      transitions: {
        init: { 'show': 'promisedShow' },
        promisedShow: { 'hide': 'promisedHide' }
      },
      states: {
        init: {},
        promisedShow: {enter: ['promisedShow']},
        promisedHide: {enter: ['promisedHide']}
      },
      promisedShow: function() {
        return new Promise(function(res, rej) { showResolve = res; });
      },
      promisedHide: function() {
        return new Promise(function(res, rej) { hideResolve = res; });
      }
    });
    stateMachine.startStateMachine();

    var showResolved = false, hideResolved = false;

    stateMachine.triggerAsync('show').then(function() {
      showResolved = true;
    });

    Promise.delay(1).then(function() {
      stateMachine.triggerAsync('hide').then(function() {
        hideResolved = true;
      });
      return Promise.delay(1);
    }).then(function() {
      equal(showResolved, false, 'nothing should have been resolved yet, but show has');
      equal(hideResolved, false, 'nothing should have been resolbed yet, but hide has');
      equal(hideResolve, undefined)
      return Promise.delay(1);
    }).then(function() {
      equal(showResolved, false, 'Show has resolved, but show shouldnt have done');
      equal(hideResolved, false, 'Hide has resolved, but should be waiting for show to complete');
      showResolve();
      return Promise.delay(1);
    }).then(function() {
      hideResolve()
      return Promise.delay(1);
    }).then(function() {
      equal(showResolved, true, 'show should have resolved by now');
      equal(hideResolved, true, 'hide should have resolved by now');
    }).finally(QUnit.start)
  });
  var eventSender = {}
  _.extend(eventSender, Backbone.Events)

module('StatefulView')

  var TestStatefulView = Backbone.StatefulView.extend({
    transitions: {
      'hidden': {
        'show': 'visible',
        'click .clickable': 'visible'
      },
      'visible': {
        'hide': 'hidden',
        'click .clickable': 'hidden',
        'click .clickable2': {enterState: 'hidden', callbacks: ['visibleToHiddenCb']}
      }
    },
    states: {
      'hidden': {className: 'hiddenBehindTree'}
    },
    events: {
      'click .clickable': 'clickedCb'
    },
    testSetUp: function(currentState) {
      this.currentState = currentState
      this.clicked = false
      this.clickEvent = null
    },
    visibleToHiddenCb: function(event) {
      this.clickEvent = event
    },
    clickedCb: function() {
      this.clicked = true
    }
  })
  var el = $('<div><span class="clickable"></span><span class="clickable2"></span></div>')
  var statefulView = new TestStatefulView({
    currentState: 'hidden',
    el: el
  })

  test('StatefulView - instanceof', function () {
    ok(statefulView instanceof Backbone.View)
  })

  asyncTest('StatefulView - transition css class auto', function () {
    statefulView.testSetUp('hidden')
    statefulView.trigger('show')
    Promise.delay(0).then(function() {
      equal(statefulView.currentState, 'visible')
      equal($(statefulView.el).attr('class'), 'visible')
    }).finally(QUnit.start)
  })

  asyncTest('StatefulView - transition css class provided', function () {
    statefulView.testSetUp('visible')
    statefulView.trigger('hide')
    Promise.delay(0).then(function() {
      equal(statefulView.currentState, 'hidden')
      equal($(statefulView.el).attr('class'), 'hiddenBehindTree')
    }).finally(QUnit.start)
  })

  asyncTest('StatefulView - trigger DOM events', function () {
    statefulView.testSetUp('hidden')

    // simple test
    $('.clickable2', statefulView.el).trigger('click')
    Promise.delay(0).then(function() {
      equal(statefulView.currentState, 'hidden')
      $('.clickable2', statefulView.el).trigger('show')
      return Promise.delay(0)
    }).then(function() {
      equal(statefulView.currentState, 'visible')
      $('.clickable2', statefulView.el).trigger('click')
      return Promise.delay(0)
    }).then(function() {
      equal(statefulView.currentState, 'hidden')
      equal(statefulView.clickEvent.type, 'click')
      // test with events that occur in several transitions
      // and with DOM events.
      $('.clickable', statefulView.el).trigger('click')
      return Promise.delay(0)
    }).then(function() {
      equal(statefulView.currentState, 'visible')
      // Test that standard View.events callbacks are still called
      equal(statefulView.clicked, true)
      $('.clickable', statefulView.el).trigger('hide')
      return Promise.delay(0)
    }).then(function() {
      equal(statefulView.currentState, 'hidden')
      return Promise.delay(0)
    }).finally(QUnit.start)
  })

module('StatefulModel')

  var TestStatefulModel = Backbone.StatefulModel.extend({
    transitions: {
      'init': {'initialized': {enterState: 'idle'}}
    }
  })
  var statefulModel = new TestStatefulModel({attr1: 11, attr2: 22})

  test('StatefulModel - instanceof', function () {
    ok(statefulModel instanceof Backbone.Model)
  })

  asyncTest('StatefulModel - sanity test', function () {
    ok(statefulModel.get('attr1'), 11)
    ok(statefulModel.get('attr2'), 22)
    ok(statefulModel.trigger('initialized'))
    Promise.delay(0).then(function() {
      equal(statefulModel.currentState, 'idle')
    }).finally(QUnit.start)
  })

})
