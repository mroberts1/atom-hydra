'use babel'

import {desktopCapturer, remote} from 'electron'
var MessagePanelView = require('atom-message-panel').MessagePanelView
var PlainMessageView = require('atom-message-panel').PlainMessageView

const { systemPreferences } = remote 

window.systemPreferences = systemPreferences

//import Audio from './audio'
import Hydra from 'hydra-synth'
//import Hydra from '../../hydra-synth'
import OscLoader from './osc-loader'
//import SourceClips from './source-clips'
const loop = require('raf-loop')
import P5 from './p5'
//import 'p5/lib/addons/p5.sound'
//import 'p5/lib/addons/p5.dom'
//{$} = require 'atom'

const PORT = 57101

export default class Main {

  constructor() {
    this.hydra = null
    this.osc = null
    this.audio = null
    this.messages = null
  
    window.P5 = P5
    window.log = this.log.bind(this)
  }

  _eval(code) {

    var success = true
    try {
      eval(code)
    } catch (e) {
      success = false
      console.log(e, e.name, e.lineNumber, e.columnNumber, e.stack)
      // this.messages.add(new PlainMessageView({
      //     message: e.message,
      //     className: 'text-error'
      // }))
      this.log(e.message, 'text-error')
    }
    if(success) {
      this.log(code, 'text-muted')
      // this.messages.add(new PlainMessageView({
      //     message: code,
      //     className: 'text-muted'
      // }))
    }
  }

  log(msg, _class) {
    this.messages.clear()
    this.messages.add(new PlainMessageView({
        message: msg,
        className: _class
    }))
  }

  evalBlock() {
    let editor
    if (editor = atom.workspace.getActiveTextEditor()) {
      var range = this.getCurrentParagraphIncludingComments(editor);
      this.evalFlash(range)
      var expression = editor.getTextInBufferRange(range);
      this._eval(expression)
    }
  }

  evalCode() {
    let editor
    if (editor = atom.workspace.getActiveTextEditor()) {
      range = {
        start: { row: 0, column: 0 },
        end: { row: editor.getLastScreenRow() + 1, column: 0 }
      }
      this.evalFlash(range);
      this._eval(editor.getText());
    }
  }

  getCurrentParagraphIncludingComments(editor) {
          var cursor = editor.getLastCursor();
          var endRow = cursor.getBufferRow();
          var startRow = endRow;
          var lineCount = editor.getLineCount();

          // lines must include non-whitespace characters
          // and not be outside editor bounds
          while (/\S/.test(editor.lineTextForBufferRow(startRow)) && startRow >= 0) {
              startRow--;
          }
          while (/\S/.test(editor.lineTextForBufferRow(endRow)) && endRow < lineCount) {
              endRow++;
          }
          return {
              start: {
                  row: startRow + 1,
                  column: 0
              },
              end: {
                  row: endRow,
                  column: 0
              },
          };
      }

      evalFlash(range) {
        console.log('evalFlash', range)
        let editor
      //  console.log("eval", atom.workspace.getActiveTextEditor())
        if (editor = atom.workspace.getActiveTextEditor()) {
          //  var editor = this.getEditor();
            var marker = editor.markBufferRange(range, {
                invalidate: 'touch'
            });

            var decoration = editor.decorateMarker(
                marker, {
                    type: 'line',
                    class: 'hydra-flash'
                });

            setTimeout(() => {
                marker.destroy();
            }, 200)

          }
        }

  evalLine () {
    let editor
  //  console.log("eval", atom.workspace.getActiveTextEditor())
    if (editor = atom.workspace.getActiveTextEditor()) {
      var range
      let selection = editor.getSelectedText()
      range = editor.getSelectedBufferRange()
        // evaluate selection, if selection is less than 1, evaluate entire line
      if(selection.length < 1){
        let pt = editor.getCursorBufferPosition()
        selection = editor.lineTextForBufferRow(pt.row)
        range ={ start: pt, end: pt }
      //  editor.selectLinesContainingCursors()
      //  selection = editor.getSelectedText()

      }
  //    console.log("evalling", selection)
      this._eval(selection)
      this.evalFlash(range)
    }
  }

  start() {
    //this.clips = new SourceClips()
    this.messages = new MessagePanelView({ title: 'hydra >>'})
    this.messages.attach()
    this.messages.toggle()
    //  if (editor = atom.workspace.getActiveTextEditor()) {
    atom.workspace.element.oncontextmenu = function(event) {
      if(event.preventDefault != undefined) event.preventDefault()
      if(event.stopPropagation != undefined) event.stopPropagation()
    }
    //  }

    const editor = atom.workspace.getActiveTextEditor()
    this.element = document.createElement('div')
    this.element.classList.add('hydra')
    this.canvas = document.createElement('canvas')
    this.canvas.classList.add('hydra-canvas')
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight

    document.body.classList.add('hydra-enabled')
    this.element.appendChild(this.canvas)
    //this.element.appendChild(this.audioCanvas)
    console.log('Hydra was toggled!', atom.workspace.element)
    atom.workspace.element.appendChild(this.element)

    // Resize canvas when window is resized
    this._onResize = () => {
      this.canvas.width = window.innerWidth
      this.canvas.height = window.innerHeight
      if (this.hydra) {
        this.hydra.setResolution(window.innerWidth, window.innerHeight)
      }
    }
    window.addEventListener('resize', this._onResize)

    this.hydra = new Hydra ({
      canvas: this.canvas,
      autoLoop: false
    })

    // hijack source initCam because default webcam.js doesn't trigger macOS permission in Electron
    this.hydra.s.forEach((source) => {
      source.initCam = async (index = 0) => {
        try {
          // Skip systemPreferences — let getUserMedia trigger macOS permission prompt directly
          console.log('initCam: requesting camera access...')

          // First, try a simple getUserMedia to trigger the macOS permission dialog
          const testStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
          // Stop the test stream immediately
          testStream.getTracks().forEach(t => t.stop())
          console.log('initCam: camera permission granted')

          // Now enumerate devices and pick the right camera
          const devices = await navigator.mediaDevices.enumerateDevices()
          const cameras = devices.filter(d => d.kind === 'videoinput')
          console.log('Available cameras:', cameras)

          let constraints = { audio: false, video: true }
          if (cameras[index]) {
            constraints.video = { deviceId: { exact: cameras[index].deviceId } }
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          const video = document.createElement('video')
          video.setAttribute('autoplay', '')
          video.setAttribute('muted', '')
          video.setAttribute('playsinline', '')
          video.srcObject = stream
          video.addEventListener('loadedmetadata', () => {
            video.play().then(() => {
              source.src = video
              source.dynamic = true
              source.tex = source.regl.texture(source.src)
              console.log('initCam: webcam initialized successfully')
            })
          })
        } catch (error) {
          console.error('initCam error:', error)
          console.error('If permission was denied, try: System Settings > Privacy & Security > Camera, or reset with: tccutil reset Camera dev.pulsar-edit.pulsar')
        }
      }
    })

    // hijack source init screen event because doesn't work in Electron
    this.hydra.s.forEach((source) => {
      source.initScreen = (index = 0) =>  desktopCapturer.getSources({types: ['window', 'screen']}).then(async (sources) => {
      console.log(sources);
        try {
            if (sources.length > index) {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sources[index].id,
                  //  minWidth: 1280,
                    maxWidth: window.innerWidth,
                //    minHeight: 720,
                    maxHeight: window.innerHeight
                  }
                }
              })
              const video = document.createElement('video')
              video.srcObject = stream
              video.addEventListener('loadedmetadata', () => {
              video.play().then(() => {
                  source.src = video
                  source.tex = source.regl.texture(source.src)
                })
              })
            }
        } catch (error) {
          console.log('initScreen error: ', error);
          throw error
        }
    
      })
    })

    const oscLoader = new OscLoader(PORT);
    this.osc = oscLoader;
    window.msg = this.osc
    oscLoader.on('message', this.onOsc)

    var self = this
    var engine = loop(function(dt) {
        // delta time in milliseconds
        self.hydra.tick(dt)
    //    self.audio.tick()
    }).start()
  }
    // osc().out()

  onOsc(msg) {
  //  console.log("OSC", msg)

  }

  stop() {
  //  this.isActive = false
    this.toggleVisibility(false) // restore atom workspace view when package is disabled
    if (this._onResize) window.removeEventListener('resize', this._onResize)
    this.hydra.regl.destroy()
    document.body.classList.remove('hydra-enabled')
    atom.workspace.element.removeChild(this.element)
    this.osc.destroy()
    this.messages.close()
    // if (this.osc) {
    //       this.osc.destroy();
    //   }

  }

  toggleVisibility(hide = true) {
    console.log('toggleVisibility() invoked')

    if (atom.packages.isPackageActive('atom-hydra')) {
      const panels = atom.workspace.element.getElementsByClassName('horizontal')[0]
      const footer = atom.workspace.element.getElementsByClassName('footer')[0]

      if (panels.style.visibility !== 'hidden' &&
          footer.style.visibility !== 'hidden' &&
          hide) {
        panels.style.visibility = 'hidden'
        footer.style.visibility = 'hidden'
      } else {
        panels.style.visibility = ''
        footer.style.visibility = ''
      }
    }

  }

}
