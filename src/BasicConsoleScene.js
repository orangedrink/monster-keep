import Phaser from 'phaser'

const AVAILABLE_COMMANDS = ['CLEAR', 'POKE', 'SHIFT', 'ROLL', 'PRINT', 'GOTO', 'VARIABLES']
const VARIABLE_NAMES = ['A', 'B', 'C', 'D']

const BIT_COUNT = 4
const LINE_NUMBER_VALUES = Array.from({ length: 20 }, (_, idx) => (idx + 1) * 10)
const GOTO_ITERATION_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

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
	init(data) {
		this.gameData = data;
		this.gameData.availableCommands = this.gameData.availableCommands || AVAILABLE_COMMANDS
		this.gameData.availableCommandKeys = this.gameData.availableCommands
		this.gameData.memoryLimit = this.gameData.memoryLimit || 8
	}
	preload() {
		this.load.image('screen', 'topdown/screen.png')
	}

	create() {
		this.availableCommandKeys = this.availableCommandKeys || AVAILABLE_COMMANDS
		this.targetBits = Phaser.Utils.Array.GetRandom(TARGET_OUTPUTS)
		this.program = []
		this.selectedLine = -1
		this.cursorVisible = true
		this.createScreen()
		this.createTextAreas()
		this.createButtons()
		this.createVariablePalette()
		this.createCommandPalette()

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
		const fontConfig = { fontFamily: 'Silkscreen', fontSize: 14, color: '#00ff9c', align: 'left' }
		const { width } = this.scale
		const screenBounds = this.screen.getBounds()

		this.codeLabel = this.add.text(
			screenBounds.left + padding + 120,
			screenBounds.top + padding + 230,
			'Ready',
			{ ...fontConfig, color: '#ffffff' }
		)

		this.codeLineStyle = { ...fontConfig, fontSize: 16 }
		this.codeLineStartX = this.codeLabel.x
		this.codeLineStartY = this.codeLabel.y + 34
		this.codeLineHeight = 22
		this.codeLines = []
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

		this.runButton = this.add.text(
			this.outputLabel.x + 350,
			screenBounds.bottom - padding - 560,
			'RUN ⏎',
			buttonStyle
		).setInteractive({ useHandCursor: true })
		this.runButton.on('pointerdown', () => this.runProgram())

		this.clearButton = this.add.text(
			this.runButton.x,
			this.runButton.y + 60,
			'DEL ⌫',
			{ ...buttonStyle, backgroundColor: '#ff6388', color: '#fff' }
		).setInteractive({ useHandCursor: true })
		this.clearButton.on('pointerdown', () => this.deleteSelectedLine())
	}

	createVariablePalette() {
		if (!this.availableCommandKeys.includes('VARIABLES')) return
		const screenBounds = this.screen.getBounds()
		const columnLeft = Math.max(20, screenBounds.left - 280)
		const { states } = this.buildCommandPanel(columnLeft, 'Variables', VARIABLE_COMMANDS)
		this.variableCommandStates = states
	}

	createCommandPalette() {
		const screenBounds = this.screen.getBounds()
		const columnLeft = screenBounds.right - 30
		const availableCommands = COMMANDS.filter((cmd) => this.availableCommandKeys.includes(cmd.key))
		const { states, nextY } = this.buildCommandPanel(columnLeft, 'Monster Basic', availableCommands)
		this.commandStates = states

		this.add.text(
			columnLeft,
			nextY,
			'Click a command to append it.\nClick DEL to remove a line.\nClick RUN to execute.',
			{ fontFamily: 'Silkscreen', fontSize: 14, color: '#cccccc' }
		)
	}

	buildCommandPanel(columnLeft, titleText, commands) {
		let currentY = 20

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
		const arrowStyle = { fontFamily: 'Silkscreen', fontSize: 8, color: '#ffffff', backgroundColor: '#333333', padding: { x: 1, y: 2 } }

		const label = this.add.text(x, y, `${paramDef.name.toUpperCase()}:`, labelStyle)
		const valueText = this.add.text(label.x + label.width + 12, y, '', valueStyle)

		const upArrow = this.add.text(
			valueText.x + valueText.width + 10,
			y+10,
			'▲',
			arrowStyle
		).setInteractive({ useHandCursor: true })
		const downArrow = this.add.text(
			upArrow.x,
			y-100,
			'▼',
			arrowStyle
		).setInteractive({ useHandCursor: true })

		upArrow.on('pointerdown', () => this.adjustParam(state, paramIndex, 1))
		downArrow.on('pointerdown', () => this.adjustParam(state, paramIndex, -1))

		const rowHeight = Math.max(label.height, downArrow.y + downArrow.height - y)
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
		display.downArrow.setX(display.upArrow.x)
		display.upArrow.setY(display.valueText.y)
		display.downArrow.setY(display.valueText.y + 10)
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
		if (this.program.length >= this.gameData.memoryLimit) {
			this.updateStatus(`Memory full. Limit is ${this.gameData.memoryLimit} lines.`, 0xff6388)
			return
		}
		const values = state.def.params.map((_, idx) => this.getParamValue(state, idx))
		const insertIndex = this.selectedLine === -1 ? this.program.length : this.selectedLine + 1
		this.program.splice(insertIndex, 0, {
			key: state.def.key,
			values
		})
		this.updateCodeText()
		this.selectLine(insertIndex)
	}

	deleteSelectedLine() {
		if (this.selectedLine === -1 || !this.program.length) return
		this.program.splice(this.selectedLine, 1)
		if (this.selectedLine >= this.program.length) {
			this.selectedLine = this.program.length - 1
		}
		if (this.program.length === 0) {
			this.selectedLine = -1
			this.cursorBlock.setVisible(false)
			this.outputText.setText('')
			this.updateStatus(`Goal: PRINT ${this.targetBits}`)
		}
		this.updateCodeText()
		this.updateLineHighlight()
		this.updateCursorPosition()
	}

	updateCodeText() {
		this.codeLines.forEach((line) => line.destroy())
		this.codeLines = []

		if (!this.program.length) {
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

		this.program.forEach((entry, index) => {
			const lineText = this.add.text(
				this.codeLineStartX,
				this.codeLineStartY + index * this.codeLineHeight,
				`${(index + 1) * 10}. ${this.formatCommand(entry)}`,
				this.codeLineStyle
			)
			lineText.setInteractive({ useHandCursor: true })
			lineText.on('pointerdown', () => this.selectLine(index))
			this.codeLines.push(lineText)
		})
		this.updateLineHighlight()
		this.updateCursorPosition()
	}

	selectLine(index) {
		if (!this.program.length) {
			this.selectedLine = -1
			this.cursorBlock.setVisible(false)
			return
		}
		this.selectedLine = Phaser.Math.Clamp(index, 0, this.program.length - 1)
		this.cursorVisible = true
		this.cursorBlock.setVisible(true)
		this.updateLineHighlight()
		this.updateCursorPosition()
	}

	updateLineHighlight() {
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
		const bounds = this.codeLines[this.selectedLine].getBounds()
		this.cursorBlock.setPosition(bounds.right + 6, bounds.top)
		this.cursorBlock.setSize(14, bounds.height)
		this.cursorBlock.setVisible(true)
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
					error = `Unknown command "${entry.key}" (line ${(pointer + 1)*10})`
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
		if (!this.isValidIndex(index)) return `Bit index must be 0-${BIT_COUNT - 1} (line ${(lineIndex + 1)*10})`
		if (value !== 0 && value !== 1) return `Value must be 0 or 1 (line ${(lineIndex + 1)*10})`
		bits[index] = value
		return null
	}

	flipBit(bits, index, lineIndex) {
		if (!this.isValidIndex(index)) return `Bit index must be 0-${BIT_COUNT - 1} (line ${(lineIndex + 1)*10})`
		bits[index] = bits[index] ? 0 : 1
		return null
	}

	isValidIndex(index) {
		return Number.isInteger(index) && index >= 0 && index <= BIT_COUNT - 1
	}

	shiftBits(bits, direction, wrap, lineIndex) {
		const dir = direction.toUpperCase()
		if (dir !== 'LEFT' && dir !== 'RIGHT') {
			return `Direction must be LEFT or RIGHT (line ${(lineIndex + 1)*10})`
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
				return { error: `Unknown variable "${rawValue}" (line ${(lineIndex + 1)*10})` }
			}
			if (typeof variables[rawValue] === 'undefined') {
				return { error: `Variable "${rawValue}" is undefined (line ${(lineIndex + 1)*10})` }
			}
			return { value: variables[rawValue] }
		}
		if (Number.isFinite(rawValue)) {
			return { value: rawValue }
		}
		return { error: `Invalid numeric value "${rawValue}" (line ${(lineIndex + 1)*10})` }
	}

	isVariableName(value) {
		return typeof value === 'string' && VARIABLE_NAMES.includes(value)
	}

	setVariable(variables, name, rawValue, lineIndex) {
		if (!this.isVariableName(name)) {
			return `Invalid variable "${name}" (line ${(lineIndex + 1)*10})`
		}
		const resolvedValue = this.resolveNumericValue(rawValue, variables, lineIndex)
		if (resolvedValue.error) return resolvedValue.error
		variables[name] = resolvedValue.value
		return null
	}

	adjustVariable(op, variables, name, lineIndex) {
		if (!this.isVariableName(name)) {
			return `Invalid variable "${name}" (line ${(lineIndex + 1)*10})`
		}
		if (typeof variables[name] === 'undefined') {
			return `Variable "${name}" must be defined with LET before ${op} (line ${(lineIndex + 1)*10})`
		}
		variables[name] += op === 'INC' ? 1 : -1
		return null
	}

	resolveGoto(lineNumber, currentLineIndex) {
		if (!Number.isInteger(lineNumber) || lineNumber <= 0 || lineNumber % 10 !== 0) {
			return { error: `Line number must be a positive multiple of 10 (line ${(currentLineIndex + 1)*10})` }
		}
		const targetIndex = lineNumber / 10 - 1
		if (targetIndex < 0 || targetIndex >= this.program.length) {
			return { error: `Line ${lineNumber} does not exist (line ${(currentLineIndex + 1)*10})` }
		}
		return { index: targetIndex }
	}

	resolveGotoIterations(rawValue, lineIndex) {
		if (!Number.isInteger(rawValue) || rawValue <= 0) {
			return { error: `GOTO iterations must be a positive integer (line ${(lineIndex + 1)*10})` }
		}
		return { value: rawValue }
	}

	updateStatus(message, color = 0xffff66) {
		this.statusText.setText(message)
		this.statusText.setColor(Phaser.Display.Color.IntegerToColor(color).rgba)
	}
}
