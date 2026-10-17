// Command seed loads the example content: the learning tracks and the course "AI tools in education"
// (lessons, module quizzes, final exam) with its translations (i18n/*.json).
//
// Idempotent: courses are matched by slug and their scalar fields refreshed; a course's modules
// are only created the first time, so content edited in the app isn't overwritten.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"

	"aiinstitute/api/internal/config"
	"aiinstitute/api/internal/store"
)

type option struct {
	text    string
	correct bool
}
type question struct {
	prompt      string
	typ         string // SINGLE_CHOICE (default) | MULTIPLE_CHOICE | TRUE_FALSE
	explanation string
	options     []option
}
type quiz struct {
	title     string
	passing   int // percent; 0 = default (70)
	questions []question
}
type lesson struct {
	title   string
	content string
	minutes int
	preview bool
}
type module struct {
	title, description string
	lessons            []lesson
	quiz               *quiz
}
type course struct {
	slug, title, summary, description string
	language, level, track            string
	hours                             int
	published                         string
	outcomes, prerequisites           []string
	modules                           []module
	finalExam                         *quiz
	instructor                        string // key into people; empty = nurlanova
}

// Demo instructors. Accounts have no usable password ("!" never matches a hash).
type person struct{ login, name, email, headline, bio string }

var people = map[string]person{
	"nurlanova": {"a.nurlanova", "Aigerim Nurlanova", "instructor@aiinstitute.example", "PhD, Associate Professor, AI Institute",
		"Teaches machine learning and data analysis. Research interests: NLP for low-resource languages."},
	"kulmurzaev": {"n.kulmurzaev", "Nurlan Kulmurzaev", "", "Director, AI Institute", ""},
}

var tracks = []struct{ slug, name, description string }{
	{"ai-in-education", "AI in Education", "Using AI tools for teaching, assessment and academic integrity."},
	{"ai-foundations", "AI Foundations", "Core ideas, history and ethics of AI, plus the math and Python you need."},
	{"machine-learning", "Machine Learning", "Supervised and unsupervised learning, model evaluation and feature engineering."},
	{"deep-learning", "Deep Learning", "Neural networks, backpropagation, CNNs, RNNs and transformers."},
	{"computer-vision", "Computer Vision", "Image classification, object detection and segmentation."},
	{"nlp", "Natural Language Processing", "Text processing, language models and NLP for Kazakh."},
}

var courses = []course{
	{
		slug:    "ai-tools-in-education",
		title:   "Білім беру саласындағы жасанды интеллект құралдары",
		summary: "Оқытушыларға арналған біліктілікті арттыру курсы: жасанды интеллектті сабақ жоспарлауда, оқу материалдарын даярлауда, бағалауда қолдану және академиялық адалдықты сақтау.",
		description: "Курс жоғары оқу орындарының профессор-оқытушылар құрамына арналған «Білім беру саласындағы жасанды интеллект құралдары» біліктілікті арттыру бағдарламасының онлайн-бөлігі. Бағдарламаны Қорқыт Ата атындағы Қызылорда университетінің Біліктілікті арттыру және қосымша білім беру орталығы ұйымдастырады.\n\n" +
			"Бес модуль: негізгі ұғымдар, тиімді сұраныс құру, жасанды интеллектті оқу үдерісінде қолдану, сенімділік пен этика, практикалық жоба. Әр модульдің соңында қысқа тест бар, курстың соңында қорытынды емтихан өтеді. Сертификат алу үшін барлық сабақты аяқтап, барлық тестті тапсыру керек.",
		language: "kk", level: "BEGINNER", track: "ai-in-education", hours: 72, published: "2026-10-15T09:00:00Z",
		instructor: "kulmurzaev",
		outcomes: []string{
			"Үлкен тілдік модельдердің мүмкіндіктері мен шектеулерін түсіндіру",
			"Рөл, міндет, контекст және формат бойынша тиімді сұраныс құру",
			"Сабақ жоспарын, тапсырмаларды және бағалау рубрикасын жасанды интеллект көмегімен даярлау",
			"Жасанды интеллект жауаптарын тексеріп, академиялық адалдық пен деректерді қорғау талаптарын сақтау",
		},
		prerequisites: []string{"Жоғары оқу орнында оқыту тәжірибесі", "Компьютер мен интернетті пайдалана білу"},
		modules: []module{
			{
				title: "Жасанды интеллекттің негізгі ұғымдары", description: "Жасанды интеллект және үлкен тілдік модельдер туралы негізгі түсінік.",
				lessons: []lesson{
					{"Үлкен тілдік модельдер қалай жұмыс істейді", "**Үлкен тілдік модель (LLM)** — өте көп мәтін негізінде үйретілген жасанды интеллект моделі. Ол мәтінді адамша «түсінбейді»: берілген мәтіннің жалғасын ықтималдығы жоғары сөздер бойынша болжайды.\n\nТанымал құралдардың мысалдары: ChatGPT, Gemini, Claude, Copilot.\n\n## Не істей алады\n\n- мәтін жазу, қысқарту, аудару;\n- сұрақтарға жауап беру, идея ұсыну;\n- кесте, тест, жоспар құрастыру;\n- формуланы, бағдарлама кодын түсіндіру.\n\n## Шектеулері\n\n- Жауап сенімді естілуі мүмкін, бірақ **қате** болуы ықтимал. Мұны *галлюцинация* дейді.\n- Модель оқытылған деректермен шектелген, соңғы жаңалықтарды білмеуі мүмкін.\n- Бір сұраққа әр жолы сәл басқаша жауап береді.\n- Жауап үшін жауапкершілік адамда қалады.\n\n## Негізгі ереже\n\nЖасанды интеллект — көмекші, ал қорытынды шешімді оқытушы қабылдайды.", 8, true},
				},
				quiz: &quiz{title: "1-модуль тесті", passing: 60, questions: []question{
					{prompt: "Үлкен тілдік модель мәтінді қалай жасайды?", explanation: "Модель берілген мәтіннің жалғасын болжайды. Ол дайын жауапты іздеп таппайды және мағынаны адамша түсінбейді.",
						options: []option{{"Мәтіннің жалғасын ықтималдығы жоғары сөздер бойынша болжайды", true}, {"Интернеттен дайын жауапты тауып, көшіріп береді", false}, {"Әр сөздің мағынасын адам секілді түсініп жазады", false}}},
					{prompt: "Галлюцинация дегеніміз не?", explanation: "Галлюцинация — модельдің сенімді көрінетін, бірақ қате немесе ойдан шығарылған жауап беруі.",
						options: []option{{"Модельдің сенімді көрінетін, бірақ қате не ойдан шығарылған жауап беруі", true}, {"Модельдің жауап беруден бас тартуы", false}, {"Интернет байланысының үзілуі", false}}},
					{prompt: "Жасанды интеллект берген жауапты тексермей-ақ сабақта қолдануға болады.", typ: "TRUE_FALSE", explanation: "Жауапты әрдайым тексеру керек: модель қателесуі мүмкін.",
						options: []option{{"Дұрыс", false}, {"Бұрыс", true}}},
				}},
			},
			{
				title: "Тиімді сұраныс (prompt) құру", description: "Жақсы нәтиже беретін сұраныстың құрылымы және оны жақсарту тәсілдері.",
				lessons: []lesson{
					{"Сұраныстың құрылымы", "Сұраныстың (prompt) сапасы жауаптың сапасын анықтайды. Жақсы сұраныста төрт бөлік болады:\n\n1. **Рөл:** модель кім болып жауап беруі керек. Мысалы: «Сен университеттің информатика пәнінің әдіскерісің».\n2. **Міндет:** нақты не істеу керек. Мысалы: «90 минуттық сабақ жоспарын құр».\n3. **Контекст:** аудитория, деңгей, шектеулер. Мысалы: «1 курс студенттері, SQL-ді алғаш үйренеді».\n4. **Формат:** жауап қандай түрде болуы керек. Мысалы: «кесте түрінде: уақыт, әрекет, күтілетін нәтиже».\n\n## Нашар және жақсы сұраныс\n\n- Нашар: «Сабақ жоспарын жаз».\n- Жақсы: «Сен информатика әдіскерісің. 1 курс студенттеріне «Деректер қоры» пәнінен 90 минуттық сабақ жоспарын құр. Студенттер SQL-ді алғаш көреді. Жауапты кесте түрінде бер: уақыт, әрекет, күтілетін нәтиже».\n\nНақты сұраныс нақты жауап береді.", 7, false},
					{"Қайталап жақсарту және мысал келтіру", "Бірінші жауап сирек мінсіз болады. Жасанды интеллектпен жұмыс — диалог: нәтижені бағалап, түзету енгізесіз.\n\n## Тәсілдер\n\n- **Нақтылау:** «Қысқарақ жаз», «Үш мысал қос», «Күрделілігін төмендет».\n- **Мысал беру:** қалаған жауаптың бір-екі үлгісін көрсетсеңіз, модель сол стильді қайталайды.\n- **Қадамдап жұмыс:** күрделі міндетті бөліп беріңіз: алдымен жоспар, содан кейін әр бөлімнің мәтіні.\n- **Шектеу қою:** «Тек берілген мәтінге сүйен», «Білмесең, білмеймін деп айт».\n\n## Назар аударыңыз\n\nСұранысқа студенттердің жеке деректерін және құпия құжаттарды қоспаңыз.", 6, false},
				},
				quiz: &quiz{title: "2-модуль тесті", passing: 60, questions: []question{
					{prompt: "Жақсы сұраныстың төрт бөлігі қайсы?", explanation: "Жақсы сұраныста рөл, міндет, контекст және формат көрсетіледі.",
						options: []option{{"Рөл, міндет, контекст, формат", true}, {"Сәлемдесу, сұрақ, алғыс, қоштасу", false}, {"Тақырып, кіріспе, негізгі бөлім, қорытынды", false}}},
					{prompt: "Модельге қалаған жауап үлгісін көрсету не береді?", explanation: "Үлгіні көрген модель сол стиль мен құрылымды қайталауға тырысады.",
						options: []option{{"Модель сол стиль мен құрылымды қайталауға тырысады", true}, {"Жауап міндетті түрде қысқа болады", false}, {"Модель интернеттен жаңа деректер жүктейді", false}}},
					{prompt: "Бірінші жауап қанағаттандырмаса, не істеген дұрыс?", explanation: "Жасанды интеллектпен жұмыс — диалог: нақтылап, түзету енгізіп, қайта сұрайсыз.",
						options: []option{{"Сұранысты нақтылап, түзету енгізіп, қайта сұрау", true}, {"Бірден тастап кету", false}, {"Жауапты өзгертпей қолдану", false}}},
					{prompt: "Жасанды интеллект қызметіне жіберуге болмайтын деректерді таңдаңыз.", typ: "MULTIPLE_CHOICE", explanation: "Студенттердің жеке деректері мен құпия құжаттарды жіберуге болмайды. Ашық тақырыптағы жалпы сұрақ қауіпсіз.",
						options: []option{{"Студенттердің жеке деректері", true}, {"Құпия ішкі құжаттар", true}, {"Ашық тақырыптағы жалпы сұрақ", false}}},
				}},
			},
			{
				title: "Жасанды интеллектті оқу үдерісінде қолдану", description: "Сабақ жоспарлау, тапсырма мен бағалау критерийлерін даярлау, студентке кері байланыс беру.",
				lessons: []lesson{
					{"Сабақ жоспары мен оқу материалдарын даярлау", "Жасанды интеллект сабаққа дайындық уақытын қысқартады, бірақ мазмұн сапасына оқытушы жауап береді.\n\n## Қайда көмектеседі\n\n- Пән бағдарламасының жобасын құру және оны модульдерге бөлу.\n- Сабақ жоспарын **оқу нәтижелеріне** сәйкестендіру.\n- Күрделі тақырыпты әртүрлі деңгейде түсіндіру: қарапайым тілмен, мысалмен, ұқсастықпен.\n- Слайдтың құрылымы мен дәріс конспектісінің жобасын жасау.\n\n## Жұмыс тәртібі\n\n1. Оқу нәтижесін өзіңіз тұжырымдаңыз.\n2. Жасанды интеллекттен жоспар жобасын сұраңыз.\n3. Мазмұнды пәніңіздің талаптарымен және дереккөздермен салыстырып тексеріңіз.\n4. Қажетсізін алып тастап, өз мысалдарыңызды қосыңыз.\n\nДайын жоба — бастапқы нүкте, соңғы нұсқа емес.", 8, false},
					{"Тапсырмалар, тесттер және бағалау рубрикасы", "Жасанды интеллект тапсырмалар жинағын тез құрастырады, ал олардың дұрыстығын оқытушы тексереді.\n\n## Тапсырма жасау\n\nСұраныста көрсетіңіз: тақырып, студент деңгейі, сұрақ саны, сұрақ түрі (бір жауапты, көп жауапты, ашық), қиындық деңгейі.\n\n## Рубрика\n\n**Рубрика** — жұмысты бағалау критерийлерінің кестесі. Жасанды интеллекттен 4–5 критерий мен әр деңгейдің сипаттамасын сұрауға болады: мысалы, «мазмұн», «құрылым», «дәлелдер», «тіл».\n\n## Тексеру тізімі\n\n- Әр сұрақтың дұрыс жауабы бар ма, ол біреу ғана ма?\n- Сұрақ оқу нәтижесіне сай ма?\n- Тілі студентке түсінікті ме?\n- Мысалдар нақты әрі дұрыс па?", 8, false},
					{"Жеке кері байланыс және оқу траекториясы", "Жасанды интеллект студенттің жұмысына **алғашқы кері байланыс** беруге көмектеседі: құрылымдағы олқылықтарды, тілдік қателерді көрсетеді, нақтылайтын сұрақтар қояды.\n\n## Қолдану жолдары\n\n- Студент өз эссесін жүктеп: «Қай жерде дәлелім әлсіз?» деп сұрайды.\n- Оқытушы жиі қайталанатын қателер бойынша жалпы ұсыныстар даярлайды.\n- Оқу материалын студенттің деңгейіне бейімдеу: қарапайым түсіндірме немесе күрделірек тапсырма.\n\n## Шектеу\n\nҚорытынды баға мен академиялық шешім әрдайым оқытушыда қалады. Жасанды интеллекттің бағасын ресми баға ретінде қолдануға болмайды.", 6, false},
				},
				quiz: &quiz{title: "3-модуль тесті", passing: 60, questions: []question{
					{prompt: "Жасанды интеллект жасаған сабақ жоспарымен қалай жұмыс істеу керек?", explanation: "Жоба тек бастапқы нүкте: оны оқу нәтижелерімен және дереккөздермен салыстырып тексеріп, өз мазмұныңызды қосу керек.",
						options: []option{{"Оқу нәтижелерімен және дереккөздермен салыстырып тексеріп, өз мазмұныңызды қосу", true}, {"Өзгертпей сол күйінде пайдалану", false}, {"Тек слайдтарды ғана қалдыру", false}}},
					{prompt: "Рубрика дегеніміз не?", explanation: "Рубрика — жұмысты бағалау критерийлері мен деңгейлерінің кестесі.",
						options: []option{{"Жұмысты бағалау критерийлері мен деңгейлерінің кестесі", true}, {"Сабақ кестесі", false}, {"Студенттер тізімі", false}}},
					{prompt: "Студенттің жұмысына қорытынды бағаны жасанды интеллект қояды.", typ: "TRUE_FALSE", explanation: "Қорытынды баға мен академиялық шешім әрдайым оқытушыда қалады.",
						options: []option{{"Дұрыс", false}, {"Бұрыс", true}}},
				}},
			},
			{
				title: "Сенімділік, академиялық адалдық және этика", description: "Жасанды интеллект жауаптарын тексеру, академиялық адалдық және деректерді қорғау.",
				lessons: []lesson{
					{"Жасанды интеллект жауаптарын тексеру", "Жасанды интеллект жауаптары сенімді естілгенімен, қате болуы мүмкін. Бұл әсіресе дерек, дәйексөз, дереккөз және сандарда жиі кездеседі.\n\n## Не тексеру керек\n\n- **Деректер мен сандар:** сенімді дереккөзбен салыстырыңыз.\n- **Дәйексөздер мен сілтемелер:** модель жоқ мақала мен авторды ойдан шығаруы мүмкін, сондықтан әрқайсысын өзіңіз іздеп табыңыз.\n- **Заңдар мен ережелер:** ресми құжаттан тексеріңіз.\n- **Есептеулер мен код:** өзіңіз іске қосып көріңіз.\n\n## Тексерудің үш қадамы\n\n1. Дереккөзді сұраңыз.\n2. Дереккөзді өзіңіз ашып, расталатынын көріңіз.\n3. Фактіні екінші тәуелсіз дереккөзбен салыстырыңыз.", 6, false},
					{"Академиялық адалдық", "Жасанды интеллекттің пайда болуы академиялық адалдық ережелерін өзгертпейді: жұмыстың авторы және ол үшін жауапты адам — студент пен оқытушы.\n\n## Ашықтық принципі\n\n- Жасанды интеллектті қолдануға қойылатын **талаптарды алдын ала хабарлаңыз**: қай тапсырмада рұқсат, қайда тыйым.\n- Жасанды интеллект көмегін пайдаланса, оны **көрсету** талабын енгізіңіз: қай құрал, қандай мақсатпен.\n- Тапсырманы **жасанды интеллект оңай орындай алмайтындай** етіп құрастырыңыз: жеке тәжірибе, жергілікті материал, ауызша қорғау.\n\n## Ескерту\n\nЖасанды интеллектті анықтайтын бағдарламалар қателесуі мүмкін, сондықтан тек олардың нәтижесіне сүйеніп студентті айыптауға болмайды.", 7, false},
					{"Жеке деректер және авторлық құқық", "## Жеке деректер\n\nСтуденттердің аты-жөнін, бағасын, құжаттарын, сондай-ақ құпия ішкі материалдарды жасанды интеллект қызметтеріне жібермеңіз: олар сыртқы серверлерде өңделуі мүмкін. Қажет болса, деректерді **анонимдеңіз**.\n\n## Авторлық құқық\n\n- Жасанды интеллект жасаған мәтінде басқа авторлардың материалы қайталануы мүмкін.\n- Басылымға немесе оқу-әдістемелік жұмысқа енгізер алдында мәтінді тексеріп, өз сөзіңізбен өңдеңіз.\n- Қолданылатын құралдың пайдалану шарттарын оқып шығыңыз.\n\n## Біржақтылық\n\nМодель оқыту деректеріндегі біржақтылықты қайталай алады. Мысалдар мен суреттерге сыни көзбен қараңыз.", 6, false},
				},
				quiz: &quiz{title: "4-модуль тесті", passing: 60, questions: []question{
					{prompt: "Жасанды интеллект берген дәйексөз бен сілтемені қалай тексеру керек?", explanation: "Модельдің өзінен қайта сұрау тексеру болып саналмайды: дереккөзді өзіңіз ашып көру керек.",
						options: []option{{"Дереккөзді өзіңіз ашып, оның шынымен бар екенін және мазмұнын салыстыру", true}, {"Модельдің өзінен: «Бұл рас па?» деп сұрау", false}, {"Тексермеу, өйткені модель ешқашан қателеспейді", false}}},
					{prompt: "Академиялық адалдық тұрғысынан қайсы тәсіл дұрыс?", explanation: "Ережені алдын ала хабарлап, жасанды интеллект көмегін көрсетуді талап ету ашықтықты қамтамасыз етеді.",
						options: []option{{"Қолдану ережелерін алдын ала хабарлап, көмекті көрсетуді талап ету", true}, {"Жасанды интеллектті толық жасырын түрде қолдану", false}, {"Тек анықтау бағдарламасына сүйеніп студентті айыптау", false}}},
					{prompt: "Студенттердің аты-жөні мен бағасын кез келген жасанды интеллект қызметіне еркін жіберуге болады.", typ: "TRUE_FALSE", explanation: "Жеке деректер сыртқы серверлерде өңделуі мүмкін, сондықтан оларды жібермеу немесе анонимдеу керек.",
						options: []option{{"Дұрыс", false}, {"Бұрыс", true}}},
					{prompt: "Қайсысы жасанды интеллект жауабын тексеру қадамына жатады?", typ: "MULTIPLE_CHOICE", explanation: "Дереккөзді өзіңіз ашу және екінші тәуелсіз дереккөзбен салыстыру тексеруге жатады. Жауаптың әдемі жазылуы оның дұрыстығын көрсетпейді.",
						options: []option{{"Дереккөзді сұрап, оны өзіңіз ашып көру", true}, {"Фактіні екінші тәуелсіз дереккөзбен салыстыру", true}, {"Жауап әдемі жазылса, дұрыс деп санау", false}}},
				}},
			},
			{
				title: "Практикалық жоба", description: "Өз пәніңізге жасанды интеллектті қолдану жоспарын құру.",
				lessons: []lesson{
					{"Өз пәніңізге жасанды интеллект қолдау жоспарын құру", "Курстың соңғы тапсырмасы — өз пәніңіз үшін жасанды интеллектті қолдану жоспарын жасау.\n\n## Тапсырма\n\n1. Пәніңіздің **бір модулін** таңдаңыз.\n2. Оның оқу нәтижелерін жазыңыз.\n3. Жасанды интеллект көмегімен сабақ жоспарының жобасын, 5 тапсырма және бір рубрика даярлаңыз.\n4. Нәтижені тексеріп, түзетіңіз: қандай қателер таптыңыз?\n5. Студенттерге арналған **қолдану ережесін** (қайда рұқсат, қайда тыйым, қалай көрсету керек) 3–4 сөйлеммен жазыңыз.\n\n## Нәтиже\n\nЖобаңызды курс оқытушысына көрсетіңіз. Содан кейін бұл сабақты өтілді деп белгілеп, қорытынды емтиханға өтіңіз.", 10, false},
				},
			},
		},
		finalExam: &quiz{title: "Қорытынды емтихан", passing: 70, questions: []question{
			{prompt: "Үлкен тілдік модельдің басты ерекшелігі қайсы?", explanation: "Модель мәтіннің жалғасын ықтималдық бойынша болжайды, сондықтан қателесуі мүмкін.",
				options: []option{{"Мәтіннің жалғасын ықтималдық бойынша болжайды", true}, {"Адам секілді мағынаны түсінеді", false}, {"Әрқашан дұрыс жауап береді", false}}},
			{prompt: "Сұраныстағы «контекст» дегеніміз не?", explanation: "Контекст — аудитория, деңгей және шектеулер туралы мәлімет.",
				options: []option{{"Аудитория, деңгей және шектеулер туралы мәлімет", true}, {"Модельдің атауы", false}, {"Жауаптың ұзындығы", false}}},
			{prompt: "Күрделі міндетті модельге қалай беру тиімді?", explanation: "Күрделі міндетті бөліктерге бөліп, қадамдап беру жақсы нәтиже береді.",
				options: []option{{"Бөліктерге бөліп, қадамдап", true}, {"Барлығын бір ұзын сөйлемге біріктіріп", false}, {"Тек «Жаз» деген бір сөзбен", false}}},
			{prompt: "Рубрика не үшін қажет?", explanation: "Рубрика бағалау критерийлерін алдын ала анық көрсетеді.",
				options: []option{{"Жұмысты бағалау критерийлерін алдын ала анық көрсету үшін", true}, {"Студенттер тізімін жүргізу үшін", false}, {"Сабақ кестесін құру үшін", false}}},
			{prompt: "Жасанды интеллекттің кері байланысы ресми баға ретінде жеткілікті.", typ: "TRUE_FALSE", explanation: "Қорытынды баға мен академиялық шешім оқытушыда қалады.",
				options: []option{{"Дұрыс", false}, {"Бұрыс", true}}},
			{prompt: "Жеке деректерге қатысты қай тәсіл дұрыс?", explanation: "Деректерді анонимдеу және қажетсізін жібермеу жеке мәліметтерді қорғайды.",
				options: []option{{"Деректерді анонимдеп, қажетсізін жібермеу", true}, {"Барлық деректі сұранысқа қосу", false}, {"Құпия құжаттарды толық жүктеу", false}}},
			{prompt: "Академиялық адалдықты қолдайтын әрекеттерді таңдаңыз.", typ: "MULTIPLE_CHOICE", explanation: "Ережені алдын ала хабарлау, көмекті көрсетуді талап ету және тапсырманы жеке тәжірибеге негіздеу адалдықты қолдайды. Тек анықтау бағдарламасына сүйеніп айыптауға болмайды.",
				options: []option{{"Қолдану ережесін алдын ала хабарлау", true}, {"Жасанды интеллект көмегін көрсетуді талап ету", true}, {"Тапсырманы жеке тәжірибеге және ауызша қорғауға негіздеу", true}, {"Тек анықтау бағдарламасына сүйеніп студентті айыптау", false}}},
			{prompt: "Галлюцинация қаупі қай жерде жоғары?", explanation: "Қате әсіресе дәйексөздер, сілтемелер және нақты сандарда жиі кездеседі.",
				options: []option{{"Дәйексөздерде, сілтемелерде және нақты сандарда", true}, {"Сәлемдесу сөздерінде", false}, {"Мәтін пішімінде", false}}},
		}}},
}

func main() {
	if len(os.Args) >= 3 && os.Args[1] == "dump" {
		if err := dump(os.Args[2]); err != nil {
			log.Fatal(err)
		}
		return
	}
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if cfg.Env == "production" && os.Getenv("ALLOW_DEMO_SEED") != "1" {
		return fmt.Errorf("refusing to seed demo content in production (set ALLOW_DEMO_SEED=1 to override)")
	}

	trs, err := loadTranslations()
	if err != nil {
		return err
	}

	ctx := context.Background()
	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer st.Close()

	tx, err := st.Pool().Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for i, t := range tracks {
		if _, err := tx.Exec(ctx, `
			INSERT INTO tracks (slug, name, description, position) VALUES ($1, $2, $3, $4)
			ON CONFLICT (slug) DO UPDATE SET name = $2, description = $3, position = $4`,
			t.slug, t.name, t.description, i); err != nil {
			return err
		}
	}

	instructorIDs := map[string]string{}
	for key, pr := range people {
		var id string
		if err := tx.QueryRow(ctx, `
			INSERT INTO users (login, email, full_name, password_hash, role, headline, bio, locale)
			VALUES ($1, NULLIF($2, ''), $3, '!', 'INSTRUCTOR', $4, NULLIF($5, ''), 'kk')
			ON CONFLICT (lower(login)) DO UPDATE SET full_name = EXCLUDED.full_name, headline = EXCLUDED.headline
			RETURNING id`, pr.login, pr.email, pr.name, pr.headline, pr.bio).Scan(&id); err != nil {
			return err
		}
		instructorIDs[key] = id
	}
	for _, c := range courses {
		published, _ := time.Parse(time.RFC3339, c.published)
		var id string
		var created bool
		err := tx.QueryRow(ctx, `
			INSERT INTO courses (slug, track_id, title, summary, description, level, language, status,
			                     estimated_hours, learning_outcomes, prerequisites, published_at)
			VALUES ($1, (SELECT id FROM tracks WHERE slug = $2), $3, $4, $5, $6, $7, 'PUBLISHED', $8, $9, $10, $11)
			ON CONFLICT (slug) DO UPDATE SET
			  track_id = EXCLUDED.track_id, title = EXCLUDED.title, summary = EXCLUDED.summary,
			  description = EXCLUDED.description, level = EXCLUDED.level, language = EXCLUDED.language,
			  estimated_hours = EXCLUDED.estimated_hours, learning_outcomes = EXCLUDED.learning_outcomes,
			  prerequisites = EXCLUDED.prerequisites, published_at = EXCLUDED.published_at, updated_at = now()
			RETURNING id, (xmax = 0)`,
			c.slug, c.track, c.title, c.summary, c.description, c.level, c.language, c.hours,
			nonNil(c.outcomes), nonNil(c.prerequisites), published).Scan(&id, &created)
		if err != nil {
			return fmt.Errorf("course %s: %w", c.slug, err)
		}
		fmt.Printf("  %-8s %s\n", map[bool]string{true: "created", false: "updated"}[created], c.slug)
		if created {
			teacher := c.instructor
			if teacher == "" {
				teacher = "nurlanova"
			}
			if _, err := tx.Exec(ctx, `INSERT INTO course_instructors (course_id, user_id, is_lead) VALUES ($1, $2, true)`,
				id, instructorIDs[teacher]); err != nil {
				return err
			}
			for mi, m := range c.modules {
				var moduleID string
				if err := tx.QueryRow(ctx,
					`INSERT INTO modules (course_id, title, description, position) VALUES ($1, $2, $3, $4) RETURNING id`,
					id, m.title, nullIfEmpty(m.description), mi).Scan(&moduleID); err != nil {
					return err
				}
				for li, l := range m.lessons {
					if _, err := tx.Exec(ctx, `
					INSERT INTO lessons (module_id, title, type, content, duration_sec, position, is_preview)
					VALUES ($1, $2, 'TEXT', $3, $4, $5, $6)`,
						moduleID, l.title, l.content, l.minutes*60, li, l.preview); err != nil {
						return err
					}
				}
				if m.quiz != nil {
					if err := insertQuiz(ctx, tx, m.quiz, &moduleID, nil); err != nil {
						return err
					}
				}
			}
			if c.finalExam != nil {
				if err := insertQuiz(ctx, tx, c.finalExam, nil, &id); err != nil {
					return err
				}
			}
		}
		if err := applyTranslations(ctx, tx, id, c, trs[c.slug]); err != nil {
			return fmt.Errorf("translations for %s: %w", c.slug, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	var nTracks, nCourses, nLessons, nQuizzes int
	err = st.Pool().QueryRow(ctx, `SELECT (SELECT count(*) FROM tracks), (SELECT count(*) FROM courses),
		(SELECT count(*) FROM lessons), (SELECT count(*) FROM quizzes)`).Scan(&nTracks, &nCourses, &nLessons, &nQuizzes)
	fmt.Printf("Seed complete: tracks=%d courses=%d lessons=%d quizzes=%d\n", nTracks, nCourses, nLessons, nQuizzes)
	return err
}

func insertQuiz(ctx context.Context, tx pgx.Tx, q *quiz, moduleID, courseID *string) error {
	var quizID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO quizzes (module_id, final_for_course_id, title, passing_score)
		 VALUES ($1, $2, $3, COALESCE(NULLIF($4, 0), 70)) RETURNING id`,
		moduleID, courseID, q.title, q.passing).Scan(&quizID); err != nil {
		return err
	}
	for qi, qu := range q.questions {
		typ := qu.typ
		if typ == "" {
			typ = "SINGLE_CHOICE"
		}
		var questionID string
		if err := tx.QueryRow(ctx, `
			INSERT INTO questions (quiz_id, type, prompt, explanation, position)
			VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			quizID, typ, qu.prompt, nullIfEmpty(qu.explanation), qi).Scan(&questionID); err != nil {
			return err
		}
		for oi, o := range qu.options {
			if _, err := tx.Exec(ctx,
				`INSERT INTO question_options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)`,
				questionID, o.text, o.correct, oi); err != nil {
				return err
			}
		}
	}
	return nil
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
