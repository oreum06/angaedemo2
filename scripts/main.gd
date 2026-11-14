extends Control

const INK = Color("55483f")
const CREAM = Color("f8f0e4")
const CARAMEL = Color("a27c65")
var sans = preload("res://assets/fonts/NotoSansCJK-Regular.ttc")
var serif = preload("res://assets/fonts/NotoSerifCJK-Regular.ttc")
var layer: Control
var body: Label
var tag: Label
var page = 0
var mode = "title"
var hidden_ui = false
var elapsed = 0.0
var speed = 35.0
var lines: Array
var history: Array[String] = []
var overlay: Control
var auto_mode = false
var auto_elapsed = 0.0
var manifest: Dictionary

func _ready():
	manifest = JSON.parse_string(FileAccess.get_file_as_string("res://data/assets.json"))
	lines = JSON.parse_string(FileAccess.get_file_as_string("res://data/preview.json"))
	var bg = TextureRect.new()
	bg.texture = load(manifest.village)
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	layer = Control.new()
	layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(layer)
	show_title()
	if "--self-test" in OS.get_cmdline_user_args():
		self_test.call_deferred()
	elif "--capture" in OS.get_cmdline_user_args():
		capture_sequence.call_deferred()

func label_at(parent: Node, text: String, rect: Rect2, px: int, color: Color = INK, book: bool = false) -> Label:
	var l = Label.new()
	l.text = text
	l.position = rect.position
	l.size = rect.size
	l.add_theme_font_override("font", serif if book else sans)
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l)
	return l

func panel(parent: Node, rect: Rect2, color: Color, radius: int = 16) -> Panel:
	var p = Panel.new()
	p.position = rect.position
	p.size = rect.size
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var s = StyleBoxFlat.new()
	s.bg_color = color
	s.set_corner_radius_all(radius)
	s.set_border_width_all(1)
	s.border_color = Color(0.65, 0.51, 0.4, 0.25)
	s.shadow_color = Color(0.25, 0.19, 0.14, 0.12)
	s.shadow_size = 12
	p.add_theme_stylebox_override("panel", s)
	parent.add_child(p)
	return p

func button_at(parent: Node, text: String, rect: Rect2, action: Callable, filled: bool = false, px: int = 24) -> Button:
	var b = Button.new()
	b.text = text
	b.position = rect.position
	b.size = rect.size
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.add_theme_font_override("font", sans)
	b.add_theme_font_size_override("font_size", px)
	b.add_theme_color_override("font_color", CREAM if filled else INK)
	b.add_theme_color_override("font_hover_color", INK)
	b.add_theme_color_override("font_focus_color", INK)
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		var s = StyleBoxFlat.new()
		s.bg_color = CARAMEL if filled else Color(0,0,0,0)
		if state in ["hover", "pressed", "focus"]:
			s.bg_color = Color("eee1d0")
			s.set_border_width_all(1)
			s.border_color = CARAMEL
		if state == "disabled":
			s.bg_color = Color(0,0,0,0)
		s.set_corner_radius_all(10)
		b.add_theme_stylebox_override(state, s)
	b.pressed.connect(action)
	parent.add_child(b)
	return b

func clear_ui():
	for child in layer.get_children():
		layer.remove_child(child)
		child.queue_free()
	overlay = null
	layer.show()
	hidden_ui = false

func show_title():
	clear_ui()
	mode = "title"
	auto_mode = false
	panel(layer, Rect2(126,116,548,842), Color(0.973,0.941,0.894,0.94), 18)
	label_at(layer, "A N G A E G O L  /  V I S U A L  N O V E L", Rect2(185,164,455,40), 17, CARAMEL)
	label_at(layer, "안개골", Rect2(180,226,450,135), 104, INK, true)
	label_at(layer, "바람나침반", Rect2(187,370,420,65), 44, INK, true)
	label_at(layer, "당신의 마음이 향하는 곳으로", Rect2(189,469,420,45), 23, Color("887565"))
	panel(layer, Rect2(190,547,74,2), CARAMEL, 0)
	button_at(layer, "새로운 이야기     →", Rect2(181,594,438,70), start_story, true, 26)
	var cont = button_at(layer, "이어지는 이야기", Rect2(181,680,438,58), func(): pass)
	cont.disabled = true
	cont.add_theme_color_override("font_disabled_color", Color("b5a99a"))
	button_at(layer, "설정", Rect2(181,750,207,58), show_settings)
	button_at(layer, "나가기", Rect2(407,750,212,58), func(): get_tree().quit())
	label_at(layer, "제1장  ·  낯선 마을의 바람", Rect2(190,861,420,40), 19, CARAMEL)
	label_at(layer, "VISUAL STUDY  01   /   배경 · 인터페이스 검토본", Rect2(126,1000,900,40), 18, CREAM)

func start_story():
	page = 0
	history.clear()
	show_scene()

func show_scene():
	clear_ui()
	mode = "scene"
	panel(layer, Rect2(84,55,370,78), Color(0.973,0.941,0.894,0.91), 10)
	label_at(layer, "제1장   낯선 마을의 바람", Rect2(108,64,340,38), 21)
	label_at(layer, "안개골 입구  /  낮", Rect2(108,101,330,27), 16, CARAMEL)
	panel(layer, Rect2(1020,55,816,64), Color(0.973,0.941,0.894,0.93), 10)
	button_at(layer, "대화 기록", Rect2(1036,63,150,48), show_history, false, 19)
	button_at(layer, "자동", Rect2(1194,63,100,48), func(): auto_mode = not auto_mode, false, 19)
	button_at(layer, "설정", Rect2(1302,63,100,48), show_settings, false, 19)
	button_at(layer, "UI 숨김 · H", Rect2(1410,63,190,48), toggle_ui, false, 19)
	button_at(layer, "타이틀", Rect2(1628,63,180,48), show_title, false, 19)
	# Missing portraits are explicitly identified; no invented character art.
	var missing: Array[String] = []
	for who in ["pomi", "maru"]:
		if ResourceLoader.exists(manifest[who]):
			var portrait = TextureRect.new()
			portrait.texture = load(manifest[who])
			portrait.position = Vector2(280 if who == "pomi" else 1080, 150)
			portrait.size = Vector2(560,830)
			portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
			layer.add_child(portrait)
		else:
			missing.append("포미" if who == "pomi" else "마루")
	if not missing.is_empty():
		panel(layer, Rect2(84,684,665,44), Color(0.973,0.941,0.894,0.92), 8)
		label_at(layer, "UI 검토본  ·  " + " / ".join(missing) + " 공식 스탠딩 미연결", Rect2(102,688,630,34), 18, Color("887565"))
	panel(layer, Rect2(84,778,1752,254), Color(0.973,0.941,0.894,0.93), 16)
	panel(layer, Rect2(118,749,246,54), CARAMEL, 10)
	tag = label_at(layer, "", Rect2(140,754,220,42), 23, CREAM)
	body = label_at(layer, "", Rect2(140,827,1625,121), 32)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label_at(layer, "SPACE / ENTER  다음     ·     H  화면 감상", Rect2(140,978,950,32), 17, Color("9a8878"))
	button_at(layer, "다음   ▷", Rect2(1615,963,160,48), advance, false, 22)
	set_line()

func set_line():
	elapsed = 0
	auto_elapsed = 0
	tag.text = lines[page].speaker
	var location = layer.get_child(2)
	if location is Label:
		location.text = "빵집 대화 · 임시 마을 배경" if page >= 2 else "안개골 입구  /  낮"
	body.text = lines[page].text
	body.visible_characters = 0
	if history.is_empty() or history.back() != tag.text + "  —  " + body.text:
		history.append(tag.text + "  —  " + body.text)

func advance():
	if mode != "scene" or is_instance_valid(overlay) or hidden_ui:
		return
	if body.visible_characters < body.text.length():
		body.visible_characters = body.text.length()
		elapsed = float(body.text.length()) / speed
	elif page < lines.size() - 1:
		page += 1
		set_line()
	else:
		show_modal("시각 검토 구간의 끝", "타이틀 · 마을 배경 · 대화 UI 검토를 위한 프리뷰입니다.\n공식 스탠딩 연결과 비주얼 검토 후 다음 제작 단계로 진행합니다.")

func toggle_ui():
	hidden_ui = not hidden_ui
	layer.visible = not hidden_ui

func show_modal(title: String, text: String):
	if is_instance_valid(overlay):
		return
	overlay = Control.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(overlay)
	panel(overlay, Rect2(0,0,1920,1080), Color(0.23,0.19,0.15,0.40), 0)
	panel(overlay, Rect2(390,210,1140,660), CREAM, 18)
	label_at(overlay, title, Rect2(450,254,1000,70), 36, INK, true)
	var content = label_at(overlay, text, Rect2(450,354,1000,380), 24)
	content.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button_at(overlay, "닫기 · Esc", Rect2(1190,772,270,58), close_modal, true)

func close_modal():
	if is_instance_valid(overlay):
		overlay.queue_free()
		overlay = null

func show_history():
	show_modal("대화 기록", "\n\n".join(history.slice(maxi(0,history.size()-6))))

func show_settings():
	show_modal("설정", "텍스트 표시 속도\n\n프리뷰는 무음으로 재생됩니다.\nH 키로 UI를 숨겨 제공된 마을 원화를 감상할 수 있습니다.")
	var slider = HSlider.new()
	slider.position = Vector2(450,420)
	slider.size = Vector2(900,35)
	slider.min_value = 15
	slider.max_value = 70
	slider.value = speed
	var track = StyleBoxFlat.new()
	track.bg_color = Color("e0d1bf")
	track.content_margin_top = 4
	track.content_margin_bottom = 4
	track.set_corner_radius_all(4)
	slider.add_theme_stylebox_override("slider", track)
	var fill = track.duplicate()
	fill.bg_color = CARAMEL
	slider.add_theme_stylebox_override("grabber_area", fill)
	slider.add_theme_stylebox_override("grabber_area_highlight", fill)
	var knob = GradientTexture2D.new()
	knob.width = 22
	knob.height = 22
	var grad = Gradient.new()
	grad.set_color(0, CARAMEL)
	grad.set_color(1, CARAMEL)
	knob.gradient = grad
	slider.add_theme_icon_override("grabber", knob)
	slider.add_theme_icon_override("grabber_highlight", knob)
	slider.value_changed.connect(func(value): speed = value)
	overlay.add_child(slider)

func _process(delta):
	if mode != "scene" or hidden_ui or is_instance_valid(overlay):
		return
	elapsed += delta
	body.visible_characters = mini(int(elapsed * speed), body.text.length())
	if auto_mode and body.visible_characters >= body.text.length():
		auto_elapsed += delta
		if auto_elapsed > 2.0 + body.text.length() * 0.06:
			advance()

func _unhandled_input(event):
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_H and mode == "scene":
			toggle_ui()
		elif event.keycode == KEY_ESCAPE:
			if hidden_ui: toggle_ui()
			elif is_instance_valid(overlay): close_modal()
			else: show_settings()
		elif event.keycode in [KEY_ENTER, KEY_SPACE]:
			advance()
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		advance()

func capture(path: String):
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://qa/" + path + ".png")

func capture_sequence():
	await get_tree().create_timer(1).timeout
	await capture("01_title_1920x1080")
	start_story()
	elapsed = 100
	await get_tree().create_timer(0.3).timeout
	await capture("02_pomi_ui_1920x1080")
	page = 2
	set_line()
	elapsed = 100
	await get_tree().create_timer(0.3).timeout
	await capture("03_pomi_maru_ui_1920x1080")
	toggle_ui()
	await get_tree().create_timer(0.2).timeout
	await capture("04_village_no_ui_1920x1080")
	print("VISUAL_CAPTURE_COMPLETE")
	get_tree().quit()

func self_test():
	await get_tree().process_frame
	assert(mode == "title")
	start_story()
	assert(page == 0 and body.visible_characters == 0)
	advance()
	assert(page == 0 and body.visible_characters == body.text.length())
	advance()
	assert(page == 1 and body.visible_characters == 0)
	var key = InputEventKey.new()
	key.keycode = KEY_H
	key.pressed = true
	Input.parse_input_event(key)
	await get_tree().process_frame
	assert(hidden_ui and not layer.visible)
	Input.parse_input_event(key)
	await get_tree().process_frame
	assert(not hidden_ui and layer.visible)
	show_history()
	var before = page
	advance()
	assert(page == before and is_instance_valid(overlay))
	close_modal()
	show_settings()
	assert(is_instance_valid(overlay))
	close_modal()
	for i in range(1, lines.size()):
		page = i
		set_line()
		assert(body.get_theme_font_size("font_size") >= 30)
		assert(body.text.length() <= 100)
	page = lines.size() - 1
	set_line()
	advance()
	advance()
	assert(is_instance_valid(overlay))
	close_modal()
	show_title()
	assert(mode == "title" and not auto_mode)
	print("PASS: typewriter reveal/advance; H input; modal guards; history; settings; six lines; end gate; title reset")
	get_tree().quit()
