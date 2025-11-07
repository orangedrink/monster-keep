import Phaser from 'phaser'

const AVAILABLE_COMMANDS = ['CLEAR', 'POKE', 'SHIFT', 'ROLL', 'PRINT', 'GOTO', 'VARIABLES']
const VARIABLE_NAMES = ['A', 'B', 'C', 'D']

const BIT_COUNT = 4
const LINE_NUMBER_VALUES = Array.from({ length: 20 }, (_, idx) => (idx + 1) * 10)
const GOTO_ITERATION_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const PROGRAM_STORAGE_KEY = 'basic-console-program'

const TARGET_OUTPUTS = [
	'1010',
	'1111',
	'0101',
	'0000',
	'1100',
	'0011'
]

const BIT_INDEX_VALUES = [0, 1, 2, 3]
const BIT_VALUE_VALUES = [0, 1]
const DIRECTION_VALUES = ['LEFT', 'RIGHT']

const withVariableOptions = (values) => [...values, ...VARIABLE_NAMES]
const BIT_INDEX_PARAM_VALUES = withVariableOptions(BIT_INDEX_VALUES)
const BIT_VALUE_PARAM_VALUES = withVariableOptions(BIT_VALUE_VALUES)
const GENERAL_NUMERIC_PARAM_VALUES = withVariableOptions(BIT_INDEX_VALUES)

const COMMANDS = [{
	key: 'CLEAR',
	params: [],
}, {
	key: 'POKE',
	params: [{
		name: 'index',
		values: BIT_INDEX_PARAM_VALUES,
	}, {
		name: 'value',
		values: BIT_VALUE_PARAM_VALUES,
	}],
}, {
	key: 'FLIP',
	params: [{
		name: 'index',
		values: BIT_INDEX_PARAM_VALUES,
	}],
}, {
	key: 'SHIFT',
	params: [{
		name: 'dir',
		values: DIRECTION_VALUES,
	}],
}, {
	key: 'ROLL',
	params: [{
		name: 'dir',
		values: DIRECTION_VALUES,
	}],
}, {
	key: 'PRINT',
	params: [],
}, {
	key: 'GOTO',
	params: [{
		name: 'line',
		values: LINE_NUMBER_VALUES,
	}, {
		name: 'times',
		values: GOTO_ITERATION_VALUES,
	}],
}]

const VARIABLE_COMMANDS = [{
	key: 'LET',
	params: [{
		name: 'var',
		values: VARIABLE_NAMES,
	}, {
		name: 'value',
		values: GENERAL_NUMERIC_PARAM_VALUES,
	}],
}, {
	key: 'INC',
	params: [{
		name: 'var',
		values: VARIABLE_NAMES,
	}],
}, {
	key: 'DEC',
	params: [{
		name: 'var',
		values: VARIABLE_NAMES,
	}],
}]

export default class BasicConsoleScene extends Phaser.Scene {

	constructor() {
		super('basic-console')
	}
	init(data = {}) {
		this.gameData = data;
		this.gameData.availableCommands = this.gameData.availableCommands || AVAILABLE_COMMANDS
		this.availableCommandKeys = this.gameData.availableCommands
		this.hasVariablePalette = this.availableCommandKeys.some((cmd) => cmd.toLowerCase() === 'variables')
		this.memoryLimit = this.gameData.memoryLimit || 8
	}
	preload() {
		this.load.image('screen', 'topdown/screen.png')
		this.load.audio('typing', 'assets/typing.wav')
	}

	create() {
		this.availableCommandKeys = this.availableCommandKeys || AVAILABLE_COMMANDS
		if (typeof this.hasVariablePalette === 'undefined') {
			this.hasVariablePalette = this.availableCommandKeys.some((cmd) => cmd.toLowerCase() === 'variables')
		}
		this.memoryLimit = this.memoryLimit || 8
		this.targetBits = Phaser.Utils.Array.GetRandom(TARGET_OUTPUTS)
		this.program = []
		this.selectedLine = -1
		this.cursorVisible = true
		this.isDraggingLine = false
		this.draggedLineOriginalIndex = null
		this.dragTargetIndex = null
		this.pendingAnimateLineIndex = null
		this.pendingDeleteLines = []
		this.pendingDeleteNextSelection = null
		this.deleteCursorActive = false
		this.highlightActive = false
		this.dragIndicatorActive = false
		this.dragStartPointer = null
		this.createScreen()
		this.createTextAreas()
		this.createButtons()
		this.createVariablePalette()
		this.createCommandPalette()
		this.registerLineDragHandlers()
		this.savePrompt = null
		this.loadPrompt = null
		this.typingSoundKey = 'typing'
		if (!this.sound.get(this.typingSoundKey)) {
			this.sound.add(this.typingSoundKey, { volume: 0.8 })
		}

		this.updateStatus(`Goal: PRINT ${this.targetBits}`)
		this.updateCodeText()
	}

	createScreen() {
		const { width, height } = this.scale
		this.screen = this.add.image(width / 2, height / 2, 'screen')
		const maxWidth = width * 1.4
		const maxHeight = height * 1.4
		const scale = Math.min(maxWidth / this.screen.width, maxHeight / this.screen.height)
		this.screen.setScale(scale)
	}

	createTextAreas() {
		const padding = 30
		const fontConfig = { fontFamily: 'Silkscreen', fontSize: 18, color: '#00ff9c', align: 'left' }
		const { width } = this.scale
		const screenBounds = this.screen.getBounds()

		this.codeLabel = this.add.text(
			screenBounds.left + padding + 120,
			screenBounds.top + padding + 230,
			'Ready>',
			{ ...fontConfig, color: '#ffffff' }
		)

		this.codeLineStyle = { ...fontConfig, fontSize: 16 }
		this.codeLineStartX = this.codeLabel.x
		this.codeLineStartY = this.codeLabel.y + 34
		this.codeLineHeight = 22
		this.codeLines = []
		this.dragIndicator = this.add.rectangle(this.codeLineStartX - 6, this.codeLineStartY, 320, 4, 0x00ff9c, 0.5)
			.setOrigin(0, 0)
			.setVisible(false)
		this.cursorBlock = this.add.rectangle(this.codeLineStartX, this.codeLineStartY, 12, 18, 0x00ff9c, 0.8)
		this.cursorBlock.setOrigin(0, 0)
		this.cursorBlock.setVisible(false)
		this.time.addEvent({
			delay: 400,
			loop: true,
			callback: () => {
				if (this.selectedLine === -1) return
				this.cursorVisible = !this.cursorVisible
				this.cursorBlock.setVisible(this.cursorVisible)
			}
		})

		this.outputLabel = this.add.text(
			this.codeLabel.x,
			screenBounds.bottom - padding - 350,
			'Output:',
			{ ...fontConfig, color: '#ffffff' }
		)

		this.outputText = this.add.text(
			this.outputLabel.x,
			this.outputLabel.y + 16,
			'',
			{ ...fontConfig, fontSize: 22 }
		)

		this.statusText = this.add.text(
			width / 2 - 88,
			screenBounds.bottom - 333,
			'',
			{ ...fontConfig, color: '#ffff66' }
		).setOrigin(0.5, 0)
	}

	createButtons() {
		const screenBounds = this.screen.getBounds()
		const padding = 30
		const buttonStyle = {
			fontFamily: 'Silkscreen',
			fontSize: 14,
			color: '#111',
			backgroundColor: '#00ff9c',
			padding: { x: 14, y: 8 }
		}
		this.add.text(
			20,
			20,
			'Commands',
			{ fontFamily: 'Silkscreen', fontSize: 22, color: '#ffffff' }
		)

		this.runButton = this.add.text(
			this.outputLabel.x - 350,
			screenBounds.top + 180,
			'RUN  ⏎',
			buttonStyle
		).setInteractive({ useHandCursor: true })
		this.runButton.on('pointerdown', () => this.runProgram())

		const buttonSpacing = 40
		this.clearButton = this.add.text(
			this.runButton.x,
			this.runButton.y + buttonSpacing,
			'DEL  ⌫',
			{ ...buttonStyle, backgroundColor: '#ff6388', color: '#fff' }
		).setInteractive({ useHandCursor: true })
		this.clearButton.on('pointerdown', () => this.deleteSelectedLine())

		this.saveButton = this.add.text(
			this.runButton.x + this.runButton.width + buttonSpacing,
			this.runButton.y,
			'SAVE ⎘',
			{ ...buttonStyle, backgroundColor: '#2dd4bf', color: '#111' }
		).setInteractive({ useHandCursor: true })
		this.saveButton.on('pointerdown', () => this.saveProgram())

		this.loadButton = this.add.text(
			this.saveButton.x,
			this.saveButton.y + buttonSpacing,
			'LOAD ⎗',
			{ ...buttonStyle, backgroundColor: '#4dabf7', color: '#111' }
		).setInteractive({ useHandCursor: true })
		this.loadButton.on('pointerdown', () => this.loadProgram())
	}

	createVariablePalette() {
		if (!this.hasVariablePalette) return
		const screenBounds = this.screen.getBounds()
		const columnLeft = Math.max(20, screenBounds.left - 280)
		const { states } = this.buildCommandPanel(columnLeft, 140, 'Variables', VARIABLE_COMMANDS)
		this.variableCommandStates = states
	}

	createCommandPalette() {
		const screenBounds = this.screen.getBounds()
		const columnLeft = screenBounds.right - 30
		const availableCommands = COMMANDS.filter((cmd) => this.availableCommandKeys.includes(cmd.key))
		const { states, nextY } = this.buildCommandPanel(columnLeft, 20, 'Monster Basic', availableCommands)
		this.commandStates = states

		this.add.text(
			columnLeft,
			nextY,
			'Click a command to append it.\nClick DEL to remove a line.\nClick RUN to execute.',
			{ fontFamily: 'Silkscreen', fontSize: 14, color: '#cccccc' }
		)
	}

	registerLineDragHandlers() {
		if (this.lineDragHandlersRegistered) return
		this.lineDragHandlersRegistered = true
		this.input.on('dragstart', this.handleLineDragStart, this)
		this.input.on('drag', this.handleLineDrag, this)
		this.input.on('dragend', this.handleLineDragEnd, this)
	}

	handleLineDragStart(pointer, gameObject) {
		if (!gameObject.isCodeLine) return
		this.isDraggingLine = true
		this.draggedLineOriginalIndex = gameObject.programIndex
		this.dragTargetIndex = gameObject.programIndex
		this.dragIndicatorActive = false
		this.dragIndicator.setVisible(false)
		this.dragStartPointer = { x: pointer.x, y: pointer.y }
		gameObject.setAlpha(0.6)
		this.highlightActive = true
		this.updateLineHighlight()
	}

	handleLineDrag(pointer, gameObject, dragX, dragY) {
		if (!gameObject.isCodeLine) return
		gameObject.x = this.codeLineStartX
		gameObject.y = dragY
		if (!this.dragIndicatorActive) {
			const start = this.dragStartPointer || { x: dragX, y: dragY }
			const moved = Math.abs(pointer.x - start.x) > 2 || Math.abs(pointer.y - start.y) > 2
			if (moved) {
				this.dragIndicatorActive = true
				this.positionDragIndicator(this.dragTargetIndex)
			}
		}
		const dropIndex = this.getDropIndexFromY(dragY)
		if (dropIndex !== this.dragTargetIndex) {
			this.dragTargetIndex = dropIndex
			this.positionDragIndicator(this.dragTargetIndex)
		}
	}

	handleLineDragEnd(pointer, gameObject) {
		if (!gameObject.isCodeLine) return
		gameObject.setAlpha(1)
		this.dragIndicator.setVisible(false)
		this.dragIndicatorActive = false
		this.dragStartPointer = null
		let finalSelectionIndex = this.draggedLineOriginalIndex
		if (this.draggedLineOriginalIndex !== null && this.dragTargetIndex !== null) {
			const newIndex = this.applyDragReorder()
			if (typeof newIndex === 'number') {
				finalSelectionIndex = newIndex
			}
		} else {
			this.updateCodeText()
		}
		if (typeof finalSelectionIndex === 'number') {
			this.selectLine(finalSelectionIndex, true)
		}
		this.isDraggingLine = false
		this.draggedLineOriginalIndex = null
		this.dragTargetIndex = null
	}

	getDropIndexFromY(yPosition) {
		if (!this.program.length) return 0
		const relativeY = yPosition - this.codeLineStartY
		let slot = Math.round(relativeY / this.codeLineHeight)
		slot = Phaser.Math.Clamp(slot, 0, this.program.length)
		return slot
	}

	positionDragIndicator(index) {
		if (index < 0) return
		const indicatorY = this.codeLineStartY + index * this.codeLineHeight - 2
		this.dragIndicator.setY(indicatorY)
		this.dragIndicator.setVisible(true)
	}

	applyDragReorder() {
		if (this.draggedLineOriginalIndex === null || this.dragTargetIndex === null || !this.program.length) {
			this.updateCodeText()
			return this.draggedLineOriginalIndex
		}
		const originalLength = this.program.length
		const fromIndex = Phaser.Math.Clamp(this.draggedLineOriginalIndex, 0, originalLength - 1)
		let targetSlot = Phaser.Math.Clamp(this.dragTargetIndex, 0, originalLength)
		const [entry] = this.program.splice(fromIndex, 1)
		if (!this.program.length) {
			this.program.push(entry)
			this.updateCodeText()
			return 0
		}
		if (targetSlot > fromIndex) {
			targetSlot = Math.max(0, targetSlot - 1)
		}
		let insertionIndex = Phaser.Math.Clamp(targetSlot, 0, this.program.length)
		this.program.splice(insertionIndex, 0, entry)
		this.updateCodeText()
		return insertionIndex
	}

	buildCommandPanel(columnLeft, y, titleText, commands) {
		let currentY = y

		this.add.text(
			columnLeft,
			currentY,
			titleText,
			{ fontFamily: 'Silkscreen', fontSize: 22, color: '#ffffff' }
		)
		currentY += 30

		const states = commands.map((cmd) => {
			const container = this.add.container(columnLeft, currentY)
			const state = {
				def: cmd,
				selections: cmd.params.map(() => 0),
				paramDisplays: [],
				container,
			}

			const button = this.add.text(
				10,
				10,
				cmd.key,
				{
					fontFamily: 'Silkscreen',
					fontSize: 16,
					color: '#111',
					backgroundColor: '#03ca7eff',
					padding: { x: 6, y: 8 },
					lineSpacing: 0,
				}
			).setInteractive({ useHandCursor: true })
			button.on('pointerdown', () => this.addCommandLine(state))
			container.add(button)
			let blockHeight = button.y + button.height
			let blockWidth = Math.max(220, button.width + 20)

			let paramX = button.x + button.width + 30
			let paramY = button.y + 6
			cmd.params.forEach((param, index) => {
				const display = this.buildParamControl(paramX, paramY, state, index, param)
				state.paramDisplays[index] = display
				paramY += display.rowHeight + 4
				blockHeight = Math.max(blockHeight, display.bottom + 10)
				blockWidth = Math.max(blockWidth, display.rightEdge + 20)
				container.add(display.label)
				container.add(display.valueText)
				container.add(display.upArrow)
				container.add(display.downArrow)
			})

			const bg = this.add.rectangle(
				0,
				0,
				Math.max(240, blockWidth),
				blockHeight + 10,
				0x000000,
				0.45
			).setStrokeStyle(2, 0x00ff9c, 0.8).setOrigin(0, 0)
			container.addAt(bg, 0)

			currentY += blockHeight + 30
			return state
		})

		return { states, nextY: currentY }
	}

	buildParamControl(x, y, state, paramIndex, paramDef) {
		const labelStyle = { fontFamily: 'Silkscreen', fontSize: 14, color: '#ffffff' }
		const valueStyle = { fontFamily: 'Silkscreen', fontSize: 16, color: '#00ff9c' }
		const arrowStyle = { fontFamily: 'Silkscreen', fontSize: 12, color: '#ffffff', backgroundColor: '#333333', padding: { x: 2, y: 2 } }

		const label = this.add.text(x, y, `${paramDef.name.toUpperCase()}:`, labelStyle)
		const valueText = this.add.text(label.x + label.width + 12, y, '', valueStyle)

		const upArrow = this.add.text(
			valueText.x + valueText.width + 6,
			y,
			'▶',
			arrowStyle
		).setInteractive({ useHandCursor: true })
		const downArrow = this.add.text(
			upArrow.x + upArrow.width + 12,
			y,
			'◀',
			arrowStyle
		).setInteractive({ useHandCursor: true })

		upArrow.on('pointerdown', () => this.adjustParam(state, paramIndex, 1))
		downArrow.on('pointerdown', () => this.adjustParam(state, paramIndex, -1))

		const rowHeight = Math.max(label.height, valueText.height)
		const rightEdge = downArrow.x + downArrow.width
		const bottom = y + rowHeight

		const display = { label, valueText, upArrow, downArrow, rowHeight, rightEdge, bottom }
		this.syncParamDisplay(state, paramIndex, display)
		return display
	}

	adjustParam(state, paramIndex, delta) {
		const values = state.def.params[paramIndex].values
		const next = Phaser.Math.Wrap(state.selections[paramIndex] + delta, 0, values.length)
		state.selections[paramIndex] = next
		this.syncParamDisplay(state, paramIndex, state.paramDisplays[paramIndex])
	}

	syncParamDisplay(state, paramIndex, display) {
		if (!display) return
		const value = this.getParamValue(state, paramIndex)
		display.valueText.setText(this.formatParamValue(value))
		display.valueText.setX(display.label.x + display.label.width + 12)
		display.upArrow.setX(display.valueText.x + display.valueText.width + 12)
		display.downArrow.setX(display.valueText.x + display.valueText.width)
		display.upArrow.setY(display.valueText.y)
		display.downArrow.setY(display.valueText.y)
		display.rightEdge = display.downArrow.x + display.downArrow.width
		display.bottom = Math.max(
			display.label.y + display.label.height,
			display.downArrow.y + display.downArrow.height
		)
	}

	getParamValue(state, paramIndex) {
		return state.def.params[paramIndex].values[state.selections[paramIndex]]
	}

	formatParamValue(value) {
		if (typeof value === 'string') return value.toUpperCase()
		return `${value}`
	}

	addCommandLine(state) {
		if (this.program.length >= this.memoryLimit) {
			this.updateStatus(`Memory full. Limit is ${this.memoryLimit} lines.`, 0xff6388)
			return
		}
		const values = state.def.params.map((_, idx) => this.getParamValue(state, idx))
		const insertIndex = this.selectedLine === -1 ? this.program.length : this.selectedLine + 1
		this.program.splice(insertIndex, 0, {
			key: state.def.key,
			values
		})
		this.pendingAnimateLineIndex = insertIndex
		this.playTypingSound()
		this.updateCodeText()
		this.selectLine(insertIndex, true)
	}

	deleteSelectedLine() {
		if (this.selectedLine === -1 || !this.program.length) return
		this.playTypingSound()
		const removedIndex = this.selectedLine
		const removedEntry = this.program[removedIndex]
		const removedText = removedEntry
			? `${(removedIndex + 1) * 10}. ${this.formatCommand(removedEntry)}`
			: (this.codeLines[removedIndex]?.text || '')
		this.program.splice(removedIndex, 1)
		this.pendingDeleteNextSelection = this.program.length
			? Math.max(Math.min(removedIndex - 1, this.program.length - 1), 0)
			: -1
		if (this.program.length === 0) {
			this.outputText.setText('')
			this.updateStatus(`Goal: PRINT ${this.targetBits}`)
		}
		if (removedText) {
			this.queueDeleteAnimation(removedIndex, removedText)
			this.selectedLine = -1
			this.deleteCursorActive = true
			this.updateCodeText()
		} else {
			this.selectedLine = this.pendingDeleteNextSelection
			this.updateCodeText()
			if (this.selectedLine >= 0) {
				this.selectLine(this.selectedLine, true)
			} else {
				this.cursorBlock.setVisible(false)
			}
		}
	}

	saveProgram() {
		if (this.savePrompt) return
		if (typeof window === 'undefined' || !window.localStorage) {
			this.updateStatus('Saving is unavailable in this environment.', 0xffae00)
			return
		}
		const store = this.getSavedProgramStore()
		const defaultName = this.buildDefaultProgramName(store)
		this.openSavePrompt(defaultName)
	}

	loadProgram() {
		try {
			if (typeof window === 'undefined' || !window.localStorage) {
				this.updateStatus('Loading is unavailable in this environment.', 0xffae00)
				return
			}
			if (this.loadPrompt) return
			const store = this.getSavedProgramStore()
			const programNames = Object.keys(store.programs)
			if (!programNames.length) {
				this.updateStatus('No saved programs available.', 0xffae00)
				return
			}
			this.openLoadPrompt(programNames, store)
		} catch (error) {
			console.error(error)
			this.updateStatus('Failed to load program.', 0xff6388)
		}
	}

	openLoadPrompt(programNames, store) {
		const width = 360
		const height = 100 + programNames.length * 28
		const posX = this.codeLineStartX + 30
		const posY = this.codeLineStartY - 30
		const background = this.add.rectangle(posX, posY, width, height, 0x000000, 0.92)
			.setOrigin(0, 0)
			.setStrokeStyle(2, 0x00ff9c, 0.8)
		const title = this.add.text(posX + 12, posY + 10, 'LOAD PROGRAM', { ...this.codeLineStyle })
		const hintStyle = { ...this.codeLineStyle, fontSize: 10 }
		const hint = this.add.text(
			posX + 12,
			posY + height - 30,
			'Click a name to load. Esc = Cancel.',
			hintStyle
		)
		const nameList = []
		let currentY = posY + 44
		programNames.forEach((name) => {
			const entryText = this.add.text(
				posX + 20,
				currentY,
				name,
				{ ...this.codeLineStyle }
			).setInteractive({ useHandCursor: true })
			entryText.on('pointerdown', () => this.handleLoadSelection(name))
			nameList.push(entryText)
			currentY += 24
		})
		const container = this.add.container(0, 0, [background, title, ...nameList, hint])
		container.setDepth(900)
		this.loadPrompt = {
			container,
			store,
			programNames,
		}
		if (this.input.keyboard) {
			this.input.keyboard.on('keydown', this.handleLoadPromptKey, this)
		}
	}

	closeLoadPrompt() {
		if (!this.loadPrompt) return
		this.loadPrompt.container.destroy(true)
		this.loadPrompt = null
		if (this.input.keyboard) {
			this.input.keyboard.off('keydown', this.handleLoadPromptKey, this)
		}
	}

	handleLoadPromptKey(event) {
		if (!this.loadPrompt) return
		if (event.key === 'Escape') {
			event.preventDefault()
			this.closeLoadPrompt()
			this.updateStatus('Load cancelled.', 0xffae00)
		}
	}

	openSavePrompt(defaultName) {
		const width = 360
		const height = 140
		const posX = this.codeLineStartX + 26
		const posY = this.codeLineStartY + 30
		const background = this.add.rectangle(posX, posY, width, height, 0x000000, 0.92)
			.setOrigin(0, 0)
			.setStrokeStyle(2, 0x00ff9c, 0.8)
		const title = this.add.text(posX + 12, posY + 10, 'SAVE PROGRAM', { ...this.codeLineStyle })
		const nameLabel = this.add.text(posX + 12, posY + 46, 'NAME:', { ...this.codeLineStyle })
		const nameValue = this.add.text(nameLabel.x + nameLabel.width + 10, nameLabel.y, defaultName, { ...this.codeLineStyle })
		const cursorHeight = this.codeLineStyle.fontSize + 3
		const cursorBlock = this.add.rectangle(nameValue.x + nameValue.width + 2, nameValue.y + 2, 10, cursorHeight, 0x00ff9c)
			.setOrigin(0, 0)
			.setAlpha(0.85)
			.setVisible(true)
		const hintStyle = { ...this.codeLineStyle, fontSize: 10 }
		const hint = this.add.text(
			posX + 12,
			posY + 82,
			'Type to edit name.\nEnter = Save,\nEsc = Cancel.',
			hintStyle
		)

		const container = this.add.container(0, 0, [background, title, nameLabel, nameValue, cursorBlock, hint])
		container.setDepth(1000)
		const blinkEvent = this.time.addEvent({
			delay: 400,
			loop: true,
			callback: () => {
				if (!this.savePrompt) {
					blinkEvent.remove()
					return
				}
				this.savePrompt.cursorVisible = !this.savePrompt.cursorVisible
				this.savePrompt.cursor.setVisible(this.savePrompt.cursorVisible)
			},
		})
		this.savePrompt = {
			container,
			nameText: nameValue,
			currentName: defaultName,
			cursor: cursorBlock,
			cursorVisible: true,
			blinkEvent,
		}
		this.updateSavePromptCursor()

		if (this.input.keyboard) {
			this.input.keyboard.on('keydown', this.handleSavePromptKey, this)
		}
	}

	closeSavePrompt() {
		if (!this.savePrompt) return
		this.savePrompt.container.destroy(true)
		if (this.savePrompt.blinkEvent) {
			this.savePrompt.blinkEvent.remove()
		}
		this.savePrompt = null
		if (this.input.keyboard) {
			this.input.keyboard.off('keydown', this.handleSavePromptKey, this)
		}
	}

	handleSavePromptKey(event) {
		if (!this.savePrompt) return
		if (event.key === 'Enter') {
			event.preventDefault()
			this.commitSavePrompt()
			return
		}
		if (event.key === 'Escape') {
			event.preventDefault()
			this.closeSavePrompt()
			this.updateStatus('Save cancelled.', 0xffae00)
			return
		}
		if (event.key === 'Backspace') {
			event.preventDefault()
			this.updateSavePromptName(this.savePrompt.currentName.slice(0, -1))
			return
		}
		if (event.key.length === 1) {
			const printable = event.key
			if (/[\w\s\-_.!?'"]/i.test(printable)) {
				event.preventDefault()
				this.updateSavePromptName(this.savePrompt.currentName + printable)
			}
		}
	}

	updateSavePromptName(newValue) {
		if (!this.savePrompt) return
		const trimmed = newValue.slice(0, 40)
		this.savePrompt.currentName = trimmed
		this.savePrompt.nameText.setText(trimmed)
		this.updateSavePromptCursor()
	}

	updateSavePromptCursor() {
		if (!this.savePrompt) return
		const cursorX = this.savePrompt.nameText.x + this.savePrompt.nameText.width + 2
		const cursorY = this.savePrompt.nameText.y + 2
		this.savePrompt.cursor.setPosition(cursorX, cursorY)
	}

	commitSavePrompt() {
		if (!this.savePrompt) return
		const name = (this.savePrompt.currentName || '').trim()
		if (!name) {
			this.updateStatus('Name cannot be empty.', 0xffae00)
			return
		}
		this.persistProgramByName(name.slice(0, 40))
		this.closeSavePrompt()
	}

	handleLoadSelection(name) {
		if (!this.loadPrompt) return
		const store = this.loadPrompt.store
		const savedProgram = store.programs[name]
		if (!savedProgram) {
			this.updateStatus(`Program "${name}" not found.`, 0xff6388)
			this.closeLoadPrompt()
			return
		}
		const sanitized = this.deserializeProgramEntries(savedProgram)
		this.closeLoadPrompt()
		if (!sanitized.length) {
			this.program = []
			this.selectedLine = -1
			this.updateCodeText()
			this.updateStatus(`Program "${name}" loaded (empty).`, 0xffff66)
			return
		}
		const trimmed = sanitized.slice(0, this.memoryLimit)
		this.program = trimmed
		this.selectedLine = trimmed.length ? 0 : -1
		this.updateCodeText()
		if (this.selectedLine !== -1) {
			this.selectLine(this.selectedLine, true)
		}
		if (sanitized.length > trimmed.length) {
			this.updateStatus(`Program "${name}" loaded (trimmed to ${this.memoryLimit} lines).`, 0xffae00)
		} else {
			this.updateStatus(`Program "${name}" loaded.`, 0x00ff9c)
		}
		this.playTypingSound()
	}

	persistProgramByName(name) {
		try {
			if (typeof window === 'undefined' || !window.localStorage) {
				this.updateStatus('Saving is unavailable in this environment.', 0xffae00)
				return
			}
			const store = this.getSavedProgramStore()
			const payload = this.serializeProgramEntries(this.program)
			store.programs[name] = payload
			store.lastSavedName = name
			window.localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(store))
			this.updateStatus(`Program "${name}" saved.`, 0x00ff9c)
		} catch (error) {
			console.error(error)
			this.updateStatus('Failed to save program.', 0xff6388)
		}
		this.playTypingSound()
	}

	getSavedProgramStore() {
		const emptyStore = { programs: {}, lastSavedName: null }
		try {
			if (typeof window === 'undefined' || !window.localStorage) return emptyStore
			const raw = window.localStorage.getItem(PROGRAM_STORAGE_KEY)
			if (!raw) return emptyStore
			const parsed = JSON.parse(raw)
			if (Array.isArray(parsed?.program)) {
				return {
					programs: { Default: parsed.program },
					lastSavedName: 'Default',
				}
			}
			if (parsed && typeof parsed === 'object' && parsed.programs && typeof parsed.programs === 'object') {
				return {
					programs: parsed.programs,
					lastSavedName: parsed.lastSavedName,
				}
			}
			return emptyStore
		} catch (error) {
			console.error(error)
			return emptyStore
		}
	}

	buildDefaultProgramName(store) {
		const base = 'Program'
		const usedNames = new Set(Object.keys(store.programs || {}))
		let suffix = Object.keys(store.programs || {}).length + 1
		let candidate = `${base} ${suffix}`
		while (usedNames.has(candidate)) {
			suffix++
			candidate = `${base} ${suffix}`
		}
		return candidate
	}

	serializeProgramEntries(programEntries) {
		return programEntries.map((entry) => ({
			key: entry.key,
			values: Array.isArray(entry.values) ? [...entry.values] : [],
		}))
	}

	deserializeProgramEntries(entries) {
		if (!Array.isArray(entries)) return []
		return entries
			.filter((entry) => entry && typeof entry.key === 'string' && Array.isArray(entry.values))
			.map((entry) => ({
				key: entry.key,
				values: [...entry.values],
			}))
	}

	playTypingSound() {
		if (!this.typingSoundKey) return
		const base = this.sound.get(this.typingSoundKey) || this.sound.add(this.typingSoundKey, { volume: 0.8 })
		if (!base) return
		const duration = base.duration || 1
		const minSlice = 0.05
		const maxSlice = 0.15
		const sliceLength = Phaser.Math.FloatBetween(minSlice, Math.min(maxSlice, duration))
		const maxStart = Math.max(0, duration - sliceLength)
		const start = Phaser.Math.FloatBetween(0, maxStart)
		const instance = this.sound.add(this.typingSoundKey, { volume: 0.8 })
		instance.play({ seek: start })
		this.time.delayedCall(sliceLength * 1000, () => {
			instance.stop()
			instance.destroy()
		})
	}

	updateCodeText() {
		const animateIndex = this.pendingAnimateLineIndex
		this.pendingAnimateLineIndex = null
		const deleteQueue = this.pendingDeleteLines.slice()
		this.pendingDeleteLines.length = 0
		this.codeLines.forEach((line) => line.destroy())
		this.codeLines = []

		if (!this.program.length) {
			this.dragIndicator.setVisible(false)
			const emptyText = this.add.text(
				this.codeLineStartX,
				this.codeLineStartY,
				'<empty>',
				{ ...this.codeLineStyle }
			)
			this.codeLines.push(emptyText)
			this.selectedLine = -1
			this.cursorBlock.setVisible(false)
			return
		}

		const shouldAnimateIndex = typeof animateIndex === 'number' ? animateIndex : -1
		this.program.forEach((entry, index) => {
			const lineText = this.add.text(
				this.codeLineStartX,
				this.codeLineStartY + index * this.codeLineHeight,
				`${(index + 1) * 10}. ${this.formatCommand(entry)}`,
				this.codeLineStyle
			)
			lineText.setInteractive({ useHandCursor: true })
			lineText.on('pointerdown', () => {
				if (this.isDraggingLine) return
				this.selectLine(index, false)
			})
			lineText.isCodeLine = true
			lineText.programIndex = index
			this.input.setDraggable(lineText)
			this.codeLines.push(lineText)
			if (index === shouldAnimateIndex) {
				this.animateLineReveal(lineText)
			}
		})
		this.updateLineHighlight()
		this.updateCursorPosition()
		deleteQueue.forEach(({ index, text }) => this.animateLineDelete(index, text))
	}

	queueDeleteAnimation(index, text) {
		if (!text) return
		this.pendingDeleteLines = this.pendingDeleteLines || []
		this.pendingDeleteLines.push({ index, text })
	}

	selectLine(index, shouldHighlight = false) {
		if (!this.program.length) {
			this.selectedLine = -1
			this.cursorBlock.setVisible(false)
			return
		}
		this.deleteCursorActive = false
		this.highlightActive = shouldHighlight
		this.selectedLine = Phaser.Math.Clamp(index, 0, this.program.length - 1)
		this.cursorVisible = true
		this.cursorBlock.setVisible(true)
		this.updateLineHighlight()
		this.updateCursorPosition()
	}

	updateLineHighlight() {
		if (!this.highlightActive) {
			this.codeLines.forEach((line) => {
				if (!line) return
				line.setColor('#00ff9c')
			})
			return
		}
		this.codeLines.forEach((line, idx) => {
			if (!line) return
			line.setColor(idx === this.selectedLine ? '#ffffff' : '#00ff9c')
		})
	}

	updateCursorPosition() {
		if (this.selectedLine === -1 || !this.codeLines[this.selectedLine]) {
			this.cursorBlock.setVisible(false)
			return
		}
		if (this.deleteCursorActive) return
		const bounds = this.codeLines[this.selectedLine].getBounds()
		this.cursorBlock.setPosition(bounds.right + 6, bounds.top)
		this.cursorBlock.setSize(14, bounds.height)
		this.cursorBlock.setVisible(true)
	}

	animateLineReveal(lineText) {
		if (!lineText || typeof lineText.programIndex === 'undefined') return
		const fullText = `${(lineText.programIndex + 1) * 10}. ${this.formatCommand(this.program[lineText.programIndex])}`
		lineText.setText('')
		let charIndex = 0
		const typingEvent = this.time.addEvent({
			delay: 20,
			loop: true,
			callback: () => {
				this.playTypingSound()
				charIndex++
				lineText.setText(fullText.slice(0, charIndex))
				if (this.selectedLine === lineText.programIndex) {
					this.updateCursorPosition()
				}
				if (charIndex >= fullText.length) {
					typingEvent.remove()
				}
			}
		})
	}

	animateLineDelete(index, text) {
		if (!text) {
			this.deleteCursorActive = false
			const nextIndex = this.pendingDeleteNextSelection
			this.pendingDeleteNextSelection = null
					if (typeof nextIndex === 'number' && nextIndex >= 0) {
						this.selectLine(nextIndex, true)
					} else {
						this.cursorBlock.setVisible(false)
					}
			return
		}
		const lineY = this.codeLineStartY + index * this.codeLineHeight
		const overlay = this.add.text(
			this.codeLineStartX,
			lineY,
			text,
			{ ...this.codeLineStyle, color: '#ff6388' }
		).setDepth(2000)
		let remaining = text.length
		const positionCursor = () => {
			const bounds = overlay.getBounds()
			this.cursorBlock.setVisible(true)
			this.cursorBlock.setPosition(bounds.right + 6, bounds.top)
			this.cursorBlock.setSize(14, bounds.height)
		}
		positionCursor()
		const deleteEvent = this.time.addEvent({
			delay: 35,
			loop: true,
			callback: () => {
				this.playTypingSound()
				remaining = Math.max(remaining - 1, 0)
				overlay.setText(text.slice(0, remaining))
				positionCursor()
				if (remaining === 0) {
					deleteEvent.remove()
					overlay.destroy()
					this.deleteCursorActive = false
					const nextIndex = this.pendingDeleteNextSelection
					this.pendingDeleteNextSelection = null
					if (typeof nextIndex === 'number' && nextIndex >= 0) {
						this.selectLine(nextIndex, true)
					} else {
						this.cursorBlock.setVisible(false)
					}
				}
			}
		})
	}

	formatCommand(entry) {
		if (!entry.values.length) return entry.key
		if (entry.key === 'LET' && entry.values.length >= 2) {
			return `${entry.key} ${this.formatParamValue(entry.values[0])} = ${this.formatParamValue(entry.values[1])}`
		}
		const params = entry.values.map((val) => this.formatParamValue(val))
		return `${entry.key} ${params.join(' ')}`
	}

	runProgram() {
		if (!this.program.length) {
			this.updateStatus('Program is empty. Add commands first.', 0xffae00)
			return
		}
		this.playTypingSound()

		let bits = new Array(BIT_COUNT).fill(0)
		let output = ''
		let error = null
		const variables = Object.create(null)
		let pointer = 0
		const gotoExecutionCounts = new Map()

		while (pointer < this.program.length) {
			const entry = this.program[pointer]
			let advancePointer = true

			switch (entry.key) {
				case 'CLEAR':
					bits = bits.map(() => 0)
					break
				case 'POKE': {
					const resolvedIndex = this.resolveNumericValue(entry.values[0], variables, pointer)
					if (resolvedIndex.error) {
						error = resolvedIndex.error
						break
					}
					const resolvedValue = this.resolveNumericValue(entry.values[1], variables, pointer)
					if (resolvedValue.error) {
						error = resolvedValue.error
						break
					}
					error = this.setBit(bits, resolvedIndex.value, resolvedValue.value, pointer)
					break
				}
				case 'FLIP':
					{
						const resolvedIndex = this.resolveNumericValue(entry.values[0], variables, pointer)
						if (resolvedIndex.error) {
							error = resolvedIndex.error
							break
						}
						error = this.flipBit(bits, resolvedIndex.value, pointer)
					}
					break
				case 'SHIFT':
					error = this.shiftBits(bits, entry.values[0], false, pointer)
					break
				case 'ROLL':
					error = this.shiftBits(bits, entry.values[0], true, pointer)
					break
				case 'PRINT':
					output = bits.join('')
					break
				case 'LET':
					error = this.setVariable(variables, entry.values[0], entry.values[1], pointer)
					break
				case 'INC':
				case 'DEC':
					error = this.adjustVariable(entry.key, variables, entry.values[0], pointer)
					break
				case 'GOTO': {
					const lineNumber = entry.values[0]
					const iterationsResult = this.resolveGotoIterations(entry.values[1], pointer)
					if (iterationsResult.error) {
						error = iterationsResult.error
						break
					}
					const allowedIterations = iterationsResult.value
					const usageKey = pointer
					const used = gotoExecutionCounts.get(usageKey) || 0
					if (used >= allowedIterations) {
						break
					}
					const jumpResult = this.resolveGoto(lineNumber, pointer)
					if (jumpResult.error) {
						error = jumpResult.error
						break
					}
					gotoExecutionCounts.set(usageKey, used + 1)
					pointer = jumpResult.index
					advancePointer = false
					break
				}
				default:
					error = `Unknown command "${entry.key}" (line ${(pointer + 1) * 10})`
			}

			if (error) break
			if (advancePointer) {
				pointer++
			}
		}

		if (error) {
			this.updateStatus(error, 0xff6388)
			return
		}

		if (!output) {
			this.updateStatus('No PRINT command executed.', 0xffae00)
			return
		}

		this.outputText.setText(output)
		if (output === this.targetBits) {
			this.updateStatus(`Success! You generated the required ${BIT_COUNT}-bit output.`, 0x00ff9c)
		} else {
			this.updateStatus(`Output mismatch. Goal: ${this.targetBits}`, 0xffae00)
		}
	}

	setBit(bits, index, value, lineIndex) {
		if (!this.isValidIndex(index)) return `Bit index must be 0-${BIT_COUNT - 1} (line ${(lineIndex + 1) * 10})`
		if (value !== 0 && value !== 1) return `Value must be 0 or 1 (line ${(lineIndex + 1) * 10})`
		bits[index] = value
		return null
	}

	flipBit(bits, index, lineIndex) {
		if (!this.isValidIndex(index)) return `Bit index must be 0-${BIT_COUNT - 1} (line ${(lineIndex + 1) * 10})`
		bits[index] = bits[index] ? 0 : 1
		return null
	}

	isValidIndex(index) {
		return Number.isInteger(index) && index >= 0 && index <= BIT_COUNT - 1
	}

	shiftBits(bits, direction, wrap, lineIndex) {
		const dir = direction.toUpperCase()
		if (dir !== 'LEFT' && dir !== 'RIGHT') {
			return `Direction must be LEFT or RIGHT (line ${(lineIndex + 1) * 10})`
		}
		if (dir === 'LEFT') {
			const first = bits.shift()
			bits.push(wrap ? first : 0)
		} else {
			const last = bits.pop()
			bits.unshift(wrap ? last : 0)
		}
		return null
	}

	resolveNumericValue(rawValue, variables, lineIndex) {
		if (typeof rawValue === 'string') {
			if (!this.isVariableName(rawValue)) {
				return { error: `Unknown variable "${rawValue}" (line ${(lineIndex + 1) * 10})` }
			}
			if (typeof variables[rawValue] === 'undefined') {
				return { error: `Variable "${rawValue}" is undefined (line ${(lineIndex + 1) * 10})` }
			}
			return { value: variables[rawValue] }
		}
		if (Number.isFinite(rawValue)) {
			return { value: rawValue }
		}
		return { error: `Invalid numeric value "${rawValue}" (line ${(lineIndex + 1) * 10})` }
	}

	isVariableName(value) {
		return typeof value === 'string' && VARIABLE_NAMES.includes(value)
	}

	setVariable(variables, name, rawValue, lineIndex) {
		if (!this.isVariableName(name)) {
			return `Invalid variable "${name}" (line ${(lineIndex + 1) * 10})`
		}
		const resolvedValue = this.resolveNumericValue(rawValue, variables, lineIndex)
		if (resolvedValue.error) return resolvedValue.error
		variables[name] = resolvedValue.value
		return null
	}

	adjustVariable(op, variables, name, lineIndex) {
		if (!this.isVariableName(name)) {
			return `Invalid variable "${name}" (line ${(lineIndex + 1) * 10})`
		}
		if (typeof variables[name] === 'undefined') {
			return `Variable "${name}" must be defined with LET before ${op} (line ${(lineIndex + 1) * 10})`
		}
		variables[name] += op === 'INC' ? 1 : -1
		return null
	}

	resolveGoto(lineNumber, currentLineIndex) {
		if (!Number.isInteger(lineNumber) || lineNumber <= 0 || lineNumber % 10 !== 0) {
			return { error: `Line number must be a positive multiple of 10 (line ${(currentLineIndex + 1) * 10})` }
		}
		const targetIndex = lineNumber / 10 - 1
		if (targetIndex < 0 || targetIndex >= this.program.length) {
			return { error: `Line ${lineNumber} does not exist (line ${(currentLineIndex + 1) * 10})` }
		}
		return { index: targetIndex }
	}

	resolveGotoIterations(rawValue, lineIndex) {
		if (!Number.isInteger(rawValue) || rawValue <= 0) {
			return { error: `GOTO iterations must be a positive integer (line ${(lineIndex + 1) * 10})` }
		}
		return { value: rawValue }
	}

	updateStatus(message, color = 0xffff66) {
		this.statusText.setText(message)
		this.statusText.setColor(Phaser.Display.Color.IntegerToColor(color).rgba)
	}
}
