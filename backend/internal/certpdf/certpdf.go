// Package certpdf renders a certificate of completion as an A4 landscape PDF.
//
// Fonts are PT Sans and PT Serif (ParaType Free Font License, embeddable): they cover the Kazakh
// letters ә ғ қ ң ө ұ ү һ і that the standard PDF fonts lack.
package certpdf

import (
	"bytes"
	_ "embed"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-pdf/fpdf"
	"github.com/skip2/go-qrcode"
)

//go:embed fonts/PTSans-Regular.ttf
var ptSans []byte

//go:embed fonts/PTSans-Bold.ttf
var ptSansBold []byte

//go:embed fonts/PTSerif-Bold.ttf
var ptSerifBold []byte

//go:embed fonts/PTSerif-Italic.ttf
var ptSerifItalic []byte

// Noto Sans KR (SIL Open Font License), reduced to Hangul, Latin and punctuation. Used when the
// certificate language is Korean or a name or course title contains Hangul.
//
//go:embed fonts/NotoSansKR-Regular.ttf
var notoKR []byte

//go:embed fonts/NotoSansKR-Bold.ttf
var notoKRBold []byte

//go:embed assets/logo.png
var logoPNG []byte

type Data struct {
	Code          string
	RecipientName string
	CourseTitle   string
	CourseHours   *int
	FinalScore    *int
	IssuedAt      time.Time
	Revoked       bool
	VerifyURL     string // encoded in the QR code
	Lang          string // kk | ru | en | ko
}

// Signatory is printed under the signature line.
type Signatory struct {
	Signature string // "N. Kulmurzaev"
}

var (
	brand = [3]int{0, 40, 179}
	ink   = [3]int{11, 18, 48}
	muted = [3]int{84, 96, 127}
	faint = [3]int{197, 219, 255}
)

type strings3 struct{ kk, ru, en, ko string }

func (s strings3) get(lang string) string {
	switch lang {
	case "ru":
		return s.ru
	case "en":
		return s.en
	case "ko":
		return s.ko
	default:
		return s.kk
	}
}

var (
	tBrand      = "AI Institute Academy"
	tUniversity = strings3{"Қорқыт Ата атындағы Қызылорда университеті", "Кызылординский университет имени Коркыт Ата", "Korkyt Ata Kyzylorda University", "코르키트 아타 크질오르다 대학교"}
	tHeading    = strings3{"КУРСТЫ АЯҚТАҒАНЫ ТУРАЛЫ СЕРТИФИКАТ", "СЕРТИФИКАТ О ПРОХОЖДЕНИИ КУРСА", "CERTIFICATE OF COMPLETION", "수료증"}
	tCertify    = strings3{"Осымен растаймыз", "Настоящим подтверждается, что", "This is to certify that", "아래 수료자가"}
	tCompleted  = strings3{"курсты сәтті аяқтады", "успешно завершил(а) курс", "has successfully completed the course", "다음 과정을 성공적으로 이수하였음을 증명합니다"}
	tDate       = strings3{"Берілген күні", "Дата выдачи", "Date of issue", "발급일"}
	tID         = strings3{"Сертификат ID", "ID сертификата", "Certificate ID", "수료증 번호"}
	tDirector   = strings3{"AI Institute директоры", "Директор AI Institute", "Director, AI Institute", "AI Institute 소장"}
	tScan       = strings3{"Тексеру үшін сканерлеңіз", "Сканируйте для проверки", "Scan to verify", "QR 코드로 진위 확인"}
	tRevoked    = strings3{"КҮШІ ЖОЙЫЛДЫ", "ОТОЗВАН", "REVOKED", "취소됨"}
)

func hoursText(lang string, h int) string {
	switch lang {
	case "ru":
		return fmt.Sprintf("%d ч", h)
	case "en":
		return fmt.Sprintf("%d hours", h)
	case "ko":
		return fmt.Sprintf("%d시간", h)
	default:
		return fmt.Sprintf("%d сағ", h)
	}
}

func scoreText(lang string, s int) string {
	switch lang {
	case "ru":
		return fmt.Sprintf("Итоговый экзамен: %d%%", s)
	case "en":
		return fmt.Sprintf("Final exam: %d%%", s)
	case "ko":
		return fmt.Sprintf("최종 시험: %d%%", s)
	default:
		return fmt.Sprintf("Қорытынды емтихан: %d%%", s)
	}
}

// hasHangul reports whether s contains Korean letters, which only the Noto Sans KR face has.
func hasHangul(s string) bool {
	for _, r := range s {
		if (r >= 0xAC00 && r <= 0xD7A3) || (r >= 0x1100 && r <= 0x11FF) || (r >= 0x3130 && r <= 0x318F) {
			return true
		}
	}
	return false
}

// fam picks the font family for a piece of text: Noto Sans KR for Korean pages and for any text with
// Hangul, PT Sans otherwise. Pass lang "" to decide from the texts alone.
func fam(lang string, texts ...string) string {
	if lang == "ko" {
		return "kr"
	}
	for _, t := range texts {
		if hasHangul(t) {
			return "kr"
		}
	}
	return "sans"
}

var monthsKK = []string{"қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"}
var monthsRU = []string{"января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"}
var monthsEN = []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}

func dateText(lang string, t time.Time) string {
	t = t.UTC()
	switch lang {
	case "ru":
		return fmt.Sprintf("%d %s %d г.", t.Day(), monthsRU[t.Month()-1], t.Year())
	case "en":
		return fmt.Sprintf("%s %d, %d", monthsEN[t.Month()-1], t.Day(), t.Year())
	case "ko":
		return fmt.Sprintf("%d년 %d월 %d일", t.Year(), int(t.Month()), t.Day())
	default:
		return fmt.Sprintf("%d жылғы %d %s", t.Year(), t.Day(), monthsKK[t.Month()-1])
	}
}

// Render returns the PDF bytes.
func Render(d Data, sig Signatory) ([]byte, error) {
	lang := d.Lang
	if lang != "ru" && lang != "en" && lang != "ko" {
		lang = "kk"
	}

	pdf := fpdf.New("L", "mm", "A4", "")
	pdf.SetAutoPageBreak(false, 0)
	pdf.SetMargins(0, 0, 0)
	pdf.SetTitle(tBrand+" — "+d.CourseTitle, true)
	pdf.SetAuthor(tBrand, true)
	pdf.SetCreator(tBrand, true)
	pdf.AddUTF8FontFromBytes("sans", "", ptSans)
	pdf.AddUTF8FontFromBytes("sans", "B", ptSansBold)
	pdf.AddUTF8FontFromBytes("serif", "B", ptSerifBold)
	pdf.AddUTF8FontFromBytes("serif", "I", ptSerifItalic)
	pdf.AddUTF8FontFromBytes("kr", "", notoKR)
	pdf.AddUTF8FontFromBytes("kr", "B", notoKRBold)
	pdf.AddPage()

	const W, H = 297.0, 210.0
	color := func(c [3]int) { pdf.SetTextColor(c[0], c[1], c[2]) }

	// Frame: heavy outer line in the brand blue, hairline inner line.
	pdf.SetDrawColor(brand[0], brand[1], brand[2])
	pdf.SetLineWidth(1.4)
	pdf.Rect(8, 8, W-16, H-16, "D")
	pdf.SetDrawColor(faint[0], faint[1], faint[2])
	pdf.SetLineWidth(0.3)
	pdf.Rect(12, 12, W-24, H-24, "D")

	// Header: mark, brand, university.
	pdf.RegisterImageOptionsReader("logo", fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(logoPNG))
	pdf.ImageOptions("logo", W/2-9, 19, 18, 18, false, fpdf.ImageOptions{}, 0, "")
	pdf.SetFont("sans", "B", 15)
	color(ink)
	pdf.SetXY(0, 38.5)
	pdf.CellFormat(W, 7, tBrand, "", 0, "C", false, 0, "")
	pdf.SetFont(fam(lang), "", 9.5)
	color(muted)
	pdf.SetXY(0, 45.5)
	pdf.CellFormat(W, 5, tUniversity.get(lang), "", 0, "C", false, 0, "")

	// Heading, letter-spaced.
	pdf.SetFont(fam(lang), "B", 12.5)
	color(brand)
	spaced(pdf, tHeading.get(lang), W/2, 63, 1.1)

	pdf.SetFont(fam(lang), "", 11)
	color(muted)
	pdf.SetXY(0, 72)
	pdf.CellFormat(W, 6, tCertify.get(lang), "", 0, "C", false, 0, "")

	// Recipient.
	nameFont := "serif"
	if hasHangul(d.RecipientName) {
		nameFont = "kr"
	}
	pdf.SetFont(nameFont, "B", fitSize(pdf, nameFont, d.RecipientName, 36, 20, W-70))
	color(ink)
	pdf.SetXY(0, 83)
	pdf.CellFormat(W, 15, d.RecipientName, "", 0, "C", false, 0, "")
	pdf.SetDrawColor(ink[0], ink[1], ink[2])
	pdf.SetLineWidth(0.25)
	nameW := pdf.GetStringWidth(d.RecipientName)
	lineW := max(nameW+24, 110)
	pdf.Line(W/2-lineW/2, 100.5, W/2+lineW/2, 100.5)

	pdf.SetFont(fam(lang), "", 11)
	color(muted)
	pdf.SetXY(0, 106)
	pdf.CellFormat(W, 6, tCompleted.get(lang), "", 0, "C", false, 0, "")

	// Course title (wraps to two lines at most).
	pdf.SetFont(fam("", d.CourseTitle), "B", 20)
	color(brand)
	pdf.SetXY(40, 116)
	pdf.MultiCell(W-80, 9, d.CourseTitle, "", "C", false)
	afterTitle := pdf.GetY()

	var facts []string
	if d.CourseHours != nil {
		facts = append(facts, hoursText(lang, *d.CourseHours))
	}
	if d.FinalScore != nil {
		facts = append(facts, scoreText(lang, *d.FinalScore))
	}
	if len(facts) > 0 {
		pdf.SetFont(fam(lang), "", 10.5)
		color(muted)
		pdf.SetXY(0, afterTitle+2)
		pdf.CellFormat(W, 6, strings.Join(facts, "  ·  "), "", 0, "C", false, 0, "")
	}

	// Footer: date + ID (left), signature (centre), QR (right).
	const fy = 164.0
	pdf.SetFont(fam(lang), "", 9)
	color(muted)
	pdf.SetXY(24, fy)
	pdf.CellFormat(80, 5, tDate.get(lang), "", 0, "L", false, 0, "")
	pdf.SetFont(fam(lang), "B", 11)
	color(ink)
	pdf.SetXY(24, fy+5)
	pdf.CellFormat(80, 6, dateText(lang, d.IssuedAt), "", 0, "L", false, 0, "")
	pdf.SetFont(fam(lang), "", 9)
	color(muted)
	pdf.SetXY(24, fy+14)
	pdf.CellFormat(80, 5, tID.get(lang), "", 0, "L", false, 0, "")
	pdf.SetFont(fam(lang), "B", 11)
	color(ink)
	pdf.SetXY(24, fy+19)
	pdf.CellFormat(80, 6, d.Code, "", 0, "L", false, 0, "")

	pdf.SetFont("serif", "I", 17)
	color(ink)
	pdf.SetXY(W/2-30, fy+4)
	pdf.CellFormat(60, 9, sig.Signature, "", 0, "C", false, 0, "")
	pdf.SetDrawColor(ink[0], ink[1], ink[2])
	pdf.SetLineWidth(0.25)
	pdf.Line(W/2-30, fy+14, W/2+30, fy+14)
	pdf.SetFont(fam(lang), "", 9)
	color(muted)
	pdf.SetXY(W/2-40, fy+15.5)
	pdf.CellFormat(80, 5, tDirector.get(lang), "", 0, "C", false, 0, "")

	// QR code as vector squares.
	if qr, err := qrcode.New(d.VerifyURL, qrcode.Medium); err == nil {
		qr.DisableBorder = true
		bm := qr.Bitmap()
		const size = 26.0
		x0, y0 := W-24-size, fy-4
		cell := size / float64(len(bm))
		pdf.SetFillColor(ink[0], ink[1], ink[2])
		for y, row := range bm {
			for x, on := range row {
				if on {
					pdf.Rect(x0+float64(x)*cell, y0+float64(y)*cell, cell+0.02, cell+0.02, "F")
				}
			}
		}
		pdf.SetFont(fam(lang), "", 8)
		color(muted)
		pdf.SetXY(x0-10, y0+size+1)
		pdf.CellFormat(size+20, 4, tScan.get(lang), "", 0, "C", false, 0, "")
	}

	if d.Revoked {
		pdf.SetFont(fam(lang), "B", 60)
		pdf.SetTextColor(brand[0], brand[1], brand[2])
		pdf.SetAlpha(0.18, "Normal")
		pdf.TransformBegin()
		pdf.TransformRotate(25, W/2, H/2)
		pdf.SetXY(0, H/2-15)
		pdf.CellFormat(W, 30, tRevoked.get(lang), "", 0, "C", false, 0, "")
		pdf.TransformEnd()
		pdf.SetAlpha(1, "Normal")
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// spaced draws text centred at cx with extra tracking between letters.
func spaced(pdf *fpdf.Fpdf, text string, cx, y, gap float64) {
	var total float64
	n := 0
	for _, r := range text {
		total += pdf.GetStringWidth(string(r))
		n++
	}
	total += gap * float64(n-1)
	x := cx - total/2
	for _, r := range text {
		pdf.Text(x, y, string(r))
		x += pdf.GetStringWidth(string(r)) + gap
	}
}

// fitSize returns the largest font size (≤ max, ≥ min) at which text fits width, using the
// currently selected font family and style.
func fitSize(pdf *fpdf.Fpdf, family, text string, max, min, width float64) float64 {
	size := max
	for size > min {
		pdf.SetFont(family, "B", size)
		if pdf.GetStringWidth(text) <= width {
			break
		}
		size -= 1
	}
	if utf8.RuneCountInString(text) == 0 {
		return max
	}
	return size
}
