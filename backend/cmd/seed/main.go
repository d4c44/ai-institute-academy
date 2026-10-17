// Command seed loads demo content for local development: tracks, a published catalog in all
// three languages, and one complete course (lessons, module quizzes, final exam).
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

func outline(titles ...string) []module {
	m := make([]module, len(titles))
	for i, t := range titles {
		m[i] = module{title: t}
	}
	return m
}

var courses = []course{
	{
		slug:    "machine-learning-fundamentals",
		title:   "Machine Learning Fundamentals",
		summary: "Regression, classification, model evaluation and scikit-learn — the core toolkit of practical machine learning.",
		description: "This course takes you from *what is a model?* to training and evaluating your own regression and classification models in Python.\n\n" +
			"Each module ends with a short quiz; pass it to unlock the next one. Finish all lessons and pass the final exam to receive a verifiable certificate.",
		language: "en", level: "INTERMEDIATE", track: "machine-learning", hours: 30, published: "2026-09-01T09:00:00Z",
		outcomes: []string{
			"Explain the difference between supervised, unsupervised and reinforcement learning",
			"Train linear and logistic regression models with scikit-learn",
			"Choose the right metric and evaluate a model on held-out data",
			"Recognise and reduce overfitting",
		},
		prerequisites: []string{"Basic Python (variables, functions, lists)", "High-school algebra"},
		modules: []module{
			{
				title: "Getting started with machine learning", description: "What machine learning is, where it is used, and how to set up your tools.",
				lessons: []lesson{
					{"What is machine learning?", "Machine learning is a way of building programs that **learn rules from data** instead of having every rule written by hand.\n\nA spam filter is a classic example: rather than listing every suspicious phrase, we show the model thousands of labelled emails and let it find the patterns that separate spam from normal mail.\n\n## Key terms\n\n- **Feature** — an input the model looks at (e.g. the number of links in an email)\n- **Label** — the answer we want to predict (spam / not spam)\n- **Model** — the function that maps features to a prediction\n- **Training** — adjusting the model so its predictions match the labels", 8, true},
					{"Types of learning", "## Supervised learning\nThe training data includes the correct answers (labels). Predicting house prices or recognising handwritten digits are supervised problems.\n\n## Unsupervised learning\nThere are no labels; the model looks for structure on its own — for example grouping customers with similar behaviour (clustering).\n\n## Reinforcement learning\nAn agent learns by acting in an environment and receiving rewards or penalties, as in game-playing systems and robotics.", 10, false},
					{"Setting up Python and scikit-learn", "We will use Python 3.12+, Jupyter and scikit-learn.\n\n```bash\npython -m venv .venv\npip install scikit-learn pandas matplotlib jupyter\n```\n\nCheck the installation:\n\n```python\nimport sklearn\nprint(sklearn.__version__)\n```", 12, false},
				},
				quiz: &quiz{title: "Module 1 quiz", questions: []question{
					{prompt: "Grouping customers by purchasing behaviour without any labels is an example of…", explanation: "There are no correct answers in the data, so this is unsupervised learning (clustering).",
						options: []option{{"Supervised learning", false}, {"Unsupervised learning", true}, {"Reinforcement learning", false}}},
					{prompt: "In a spam filter, the value *spam / not spam* is the…",
						options: []option{{"Feature", false}, {"Label", true}, {"Model", false}}},
					{prompt: "A model learns rules from data instead of having them written by hand.", typ: "TRUE_FALSE",
						options: []option{{"True", true}, {"False", false}}},
				}},
			},
			{
				title: "Regression", description: "Predicting continuous values and measuring how good those predictions are.",
				lessons: []lesson{
					{"Linear regression", "Linear regression fits a straight line (or a hyperplane) through the data:\n\n$\\hat{y} = w_1x_1 + w_2x_2 + \\dots + b$\n\n```python\nfrom sklearn.linear_model import LinearRegression\nmodel = LinearRegression().fit(X_train, y_train)\nprint(model.coef_, model.intercept_)\n```", 15, false},
					{"Loss functions and gradient descent", "To train a model we need a number that says how wrong it is — the **loss**. For regression the usual choice is the mean squared error (MSE).\n\nGradient descent lowers the loss step by step: compute the gradient, move the weights a little in the opposite direction, repeat. The step size is the **learning rate**.", 15, false},
					{"Evaluating regression models", "Always evaluate on data the model has **not** seen during training.\n\n- **MAE** — average absolute error, in the units of the target\n- **RMSE** — penalises large errors more\n- **R²** — share of variance explained (1.0 is perfect)\n\n```python\nfrom sklearn.model_selection import train_test_split\nX_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)\n```", 12, false},
				},
				quiz: &quiz{title: "Module 2 quiz", questions: []question{
					{prompt: "Which metric is expressed in the same units as the target variable?",
						options: []option{{"R²", false}, {"MAE", true}, {"Accuracy", false}}},
					{prompt: "What does the learning rate control in gradient descent?",
						options: []option{{"The number of features", false}, {"The size of each update step", true}, {"The share of data used for testing", false}}},
				}},
			},
			{
				title: "Classification", description: "Predicting categories, and why accuracy alone can be misleading.",
				lessons: []lesson{
					{"Logistic regression", "Despite its name, logistic regression is a **classification** model. It passes a linear score through the sigmoid function to get a probability between 0 and 1.\n\n```python\nfrom sklearn.linear_model import LogisticRegression\nclf = LogisticRegression(max_iter=1000).fit(X_train, y_train)\nclf.predict_proba(X_test[:5])\n```", 14, false},
					{"Decision trees and random forests", "A decision tree splits the data with a sequence of yes/no questions. Single trees overfit easily; a **random forest** trains many trees on random subsets of the data and averages their votes, which is far more robust.", 16, false},
					{"Precision, recall and F1", "On imbalanced data, accuracy can be misleading: a model that always predicts *not fraud* is 99% accurate if fraud is 1% of cases.\n\n- **Precision** — of the items flagged positive, how many really are\n- **Recall** — of the real positives, how many we found\n- **F1** — the harmonic mean of the two", 14, false},
				},
				quiz: &quiz{title: "Module 3 quiz", questions: []question{
					{prompt: "Logistic regression is mainly used for…",
						options: []option{{"Regression", false}, {"Classification", true}, {"Clustering", false}}},
					{prompt: "Which metrics are better than accuracy on heavily imbalanced data? (Select all that apply)", typ: "MULTIPLE_CHOICE",
						options: []option{{"Precision", true}, {"Recall", true}, {"Training time", false}}},
				}},
			},
		},
		finalExam: &quiz{title: "Final exam", questions: []question{
			{prompt: "Why do we evaluate a model on a separate test set?",
				options: []option{{"To train faster", false}, {"To estimate performance on unseen data", true}, {"To increase the number of features", false}}},
			{prompt: "A random forest is…",
				options: []option{{"A single deep decision tree", false}, {"An ensemble of decision trees whose votes are combined", true}, {"A type of linear regression", false}}},
			{prompt: "Mean squared error is a typical loss function for regression.", typ: "TRUE_FALSE",
				options: []option{{"True", true}, {"False", false}}},
			{prompt: "Which of these are supervised learning tasks? (Select all that apply)", typ: "MULTIPLE_CHOICE",
				options: []option{{"Predicting house prices", true}, {"Detecting spam from labelled emails", true}, {"Clustering customers without labels", false}}},
		}},
	},
	{
		slug:    "ai-basics",
		title:   "Основы искусственного интеллекта",
		summary: "Что такое ИИ, как машины учатся на данных и где это применяется. Короткий курс без программирования, после которого вы получите сертификат.",
		description: "Вводный курс для тех, кто хочет разобраться, что стоит за словами «искусственный интеллект» и «машинное обучение».\n\n" +
			"Три модуля: история и основные понятия, принципы обучения моделей, применение и этика. В конце каждого модуля короткий тест, в конце курса итоговый экзамен. " +
			"Чтобы получить сертификат, нужно пройти все уроки и сдать все тесты. Опыт программирования не требуется.",
		language: "ru", level: "BEGINNER", track: "ai-foundations", hours: 6, published: "2026-10-10T09:00:00Z",
		outcomes: []string{
			"Объяснить, что такое искусственный интеллект, и отличить узкий ИИ от общего",
			"Описать, как модель обучается на данных, и назвать три основных типа обучения",
			"Распознавать переобучение и объяснить, зачем нужна проверка на новых данных",
			"Оценить этические риски применения ИИ: предвзятость, приватность, ответственность",
		},
		prerequisites: []string{},
		modules: []module{
			{
				title: "Что такое искусственный интеллект", description: "Определение, краткая история и виды ИИ.",
				lessons: []lesson{
					{"Определение и краткая история", "**Искусственный интеллект (ИИ)** — область информатики, в которой создают программы, способные решать задачи, обычно требующие человеческого интеллекта: распознавать речь и изображения, переводить тексты, принимать решения.\n\n## Ключевые вехи\n\n- **1950** — Алан Тьюринг публикует статью «Вычислительные машины и разум» и предлагает тест, названный его именем.\n- **1956** — на Дартмутском семинаре Джон Маккарти вводит термин «искусственный интеллект».\n- **1997** — шахматная программа Deep Blue обыгрывает чемпиона мира Гарри Каспарова.\n- **2016** — AlphaGo побеждает Ли Седоля в игре го.\n- **2020-е** — большие языковые модели учатся вести диалог и писать тексты.\n\nРазвитие шло волнами: периоды больших ожиданий сменялись «зимами ИИ», когда финансирование сокращалось, потому что результаты не оправдывали обещаний.", 6, true},
					{"Узкий и общий ИИ", "Все системы ИИ, которые существуют сегодня, относятся к **узкому ИИ**: они хорошо решают одну конкретную задачу и не умеют переносить навыки на другие.\n\n## Виды ИИ\n\n- **Узкий ИИ (ANI)** — шахматная программа, рекомендательная система, голосовой помощник. Эти системы не понимают мир, они находят закономерности в данных.\n- **Общий ИИ (AGI)** — гипотетическая система, способная решать любые интеллектуальные задачи на уровне человека. Пока её не существует.\n- **Сверхразум** — ещё более гипотетическая система, превосходящая человека во всех областях.\n\nКогда в новостях говорят «ИИ сдал экзамен» или «ИИ нарисовал картину», речь идёт об узком ИИ, очень мощном, но специализированном.", 5, false},
				},
				quiz: &quiz{title: "Тест по модулю 1", passing: 60, questions: []question{
					{prompt: "В каком году на Дартмутском семинаре был введён термин «искусственный интеллект»?", explanation: "Термин предложил Джон Маккарти в 1956 году при подготовке Дартмутского семинара.",
						options: []option{{"1956", true}, {"1926", false}, {"1989", false}}},
					{prompt: "К какому виду относятся все существующие сегодня системы ИИ?", explanation: "Общего ИИ (AGI) пока не существует, все современные системы специализированы.",
						options: []option{{"Общий ИИ (AGI)", false}, {"Узкий ИИ (ANI)", true}, {"Сверхразум", false}}},
					{prompt: "Шахматная программа Deep Blue обыграла чемпиона мира Гарри Каспарова.", typ: "TRUE_FALSE", explanation: "Это произошло в 1997 году.",
						options: []option{{"Верно", true}, {"Неверно", false}}},
				}},
			},
			{
				title: "Как машины учатся", description: "Данные, признаки, модели и три типа обучения.",
				lessons: []lesson{
					{"Данные, признаки и модели", "В классическом программировании человек пишет правила, а компьютер их выполняет. В **машинном обучении** наоборот: человек даёт примеры, а программа сама находит правила.\n\n## Основные понятия\n\n- **Данные** — примеры, на которых учится система (письма, снимки, таблицы).\n- **Признак** — измеримая характеристика примера: число ссылок в письме, площадь квартиры, возраст клиента.\n- **Метка** — правильный ответ, который нужно предсказывать: «спам» или «не спам», цена квартиры.\n- **Модель** — математическая функция, которая по признакам выдаёт предсказание.\n- **Обучение** — подбор параметров модели так, чтобы её предсказания совпадали с метками на обучающих данных.\n\nКачество модели почти всегда упирается в качество данных: ошибки и перекосы в данных переходят в модель.", 7, false},
					{"Три типа обучения", "## Обучение с учителем\n\nВ данных есть правильные ответы (метки). Модель учится их предсказывать. Примеры: определение спама, прогноз цены, распознавание рукописных цифр.\n\n## Обучение без учителя\n\nМеток нет, модель ищет структуру сама. Пример: разбиение клиентов на группы со схожим поведением (кластеризация).\n\n## Обучение с подкреплением\n\nАгент действует в среде и получает награду или штраф. Так учатся игровые программы и роботы: они пробуют, оценивают результат и улучшают стратегию.", 6, false},
					{"Переобучение и проверка модели", "Модель, которая идеально запомнила обучающие примеры, может плохо работать на новых данных. Это называется **переобучением**.\n\nПредставьте студента, который выучил ответы на билеты наизусть: на знакомые вопросы он отвечает отлично, а при малейшем изменении формулировки теряется.\n\n## Как защититься\n\n1. Делить данные на **обучающую** и **тестовую** выборки и оценивать качество только на тестовой.\n2. Использовать больше разнообразных данных.\n3. Выбирать более простую модель, если сложная переобучается.\n\nЧестная оценка всегда делается на данных, которые модель не видела во время обучения.", 6, false},
				},
				quiz: &quiz{title: "Тест по модулю 2", passing: 60, questions: []question{
					{prompt: "Как называется правильный ответ, который модель учится предсказывать?", explanation: "Метка — это целевое значение для каждого примера в обучающих данных.",
						options: []option{{"Признак", false}, {"Метка", true}, {"Параметр", false}}},
					{prompt: "Разбиение клиентов на группы без заранее известных категорий — пример…", explanation: "Меток нет, модель сама ищет структуру: это обучение без учителя (кластеризация).",
						options: []option{{"Обучения с учителем", false}, {"Обучения без учителя", true}, {"Обучения с подкреплением", false}}},
					{prompt: "Что такое переобучение?", explanation: "Модель запоминает обучающие примеры вместо того, чтобы находить общие закономерности.",
						options: []option{{"Модель плохо работает и на обучающих, и на новых данных", false}, {"Модель хорошо работает на обучающих данных, но плохо на новых", true}, {"Модель обучали слишком мало времени", false}}},
					{prompt: "Выберите все верные способы бороться с переобучением.", typ: "MULTIPLE_CHOICE", explanation: "Проверка на тестовой выборке, больше разнообразных данных и более простая модель помогают. Оценка на обучающих данных переобучение не выявляет.",
						options: []option{{"Оценивать качество на тестовой выборке", true}, {"Собрать больше разнообразных данных", true}, {"Оценивать качество только на обучающих данных", false}}},
				}},
			},
			{
				title: "ИИ в жизни и этика", description: "Где применяется ИИ и какие вопросы ответственности он поднимает.",
				lessons: []lesson{
					{"Где применяется ИИ", "Системы ИИ уже встроены в привычные сервисы:\n\n- **Медицина** — анализ снимков и поддержка врача при постановке диагноза.\n- **Транспорт** — навигация, прогноз пробок, системы помощи водителю.\n- **Образование** — адаптивные тренажёры, автоматическая проверка заданий.\n- **Сельское хозяйство** — анализ спутниковых снимков полей, прогноз урожайности.\n- **Банки и торговля** — выявление мошенничества, рекомендации товаров.\n- **Язык** — машинный перевод, голосовые помощники, поиск.\n\nВо всех этих случаях ИИ усиливает человека, но не заменяет ответственность за решение.", 5, false},
					{"Этика, предвзятость и ответственность", "Модель учится на данных, поэтому повторяет их перекосы. Если в прошлых данных о найме предпочтение отдавалось определённой группе, модель может воспроизвести эту предвзятость.\n\n## Ключевые вопросы\n\n- **Предвзятость и справедливость** — одинаково ли система работает для разных групп людей?\n- **Приватность** — какие личные данные собираются и как они защищены?\n- **Объяснимость** — можно ли понять, почему система приняла именно такое решение?\n- **Ответственность** — кто отвечает за ошибку: разработчик, владелец сервиса, пользователь?\n\nПринцип ответственного применения прост: важные решения о людях не должны приниматься без человеческого контроля и возможности обжалования.", 6, false},
				},
				quiz: &quiz{title: "Тест по модулю 3", passing: 60, questions: []question{
					{prompt: "Почему модель может быть предвзятой?", explanation: "Модель учится на данных и воспроизводит перекосы, которые в них есть.",
						options: []option{{"Потому что она учится на данных, в которых есть перекосы", true}, {"Потому что компьютеры не умеют считать точно", false}, {"Потому что модель сама придумывает правила", false}}},
					{prompt: "Что означает объяснимость системы ИИ?", explanation: "Объяснимость — возможность понять причины конкретного решения системы.",
						options: []option{{"Система работает быстро", false}, {"Можно понять, почему система приняла именно такое решение", true}, {"Система имеет понятный интерфейс", false}}},
					{prompt: "Важные решения о людях должны приниматься без участия человека, если модель точная.", typ: "TRUE_FALSE", explanation: "Даже точная модель ошибается. Важные решения требуют человеческого контроля и возможности обжалования.",
						options: []option{{"Верно", false}, {"Неверно", true}}},
				}},
			},
		},
		finalExam: &quiz{title: "Итоговый экзамен", passing: 70, questions: []question{
			{prompt: "Кто предложил тест, позволяющий оценить, обладает ли машина интеллектом?", explanation: "Алан Тьюринг описал этот тест в статье 1950 года.",
				options: []option{{"Алан Тьюринг", true}, {"Джон Маккарти", false}, {"Гарри Каспаров", false}}},
			{prompt: "Какая система ИИ существует на сегодняшний день?", explanation: "Все современные системы — узкий ИИ. Общий ИИ и сверхразум пока гипотетические.",
				options: []option{{"Общий ИИ, решающий любые задачи", false}, {"Узкий ИИ, решающий конкретные задачи", true}, {"Сверхразум", false}}},
			{prompt: "Признак — это…", explanation: "Признак — измеримая характеристика примера, по которой модель делает предсказание.",
				options: []option{{"Правильный ответ для примера", false}, {"Измеримая характеристика примера", true}, {"Результат проверки модели", false}}},
			{prompt: "В каких задачах используется обучение с подкреплением?", explanation: "Агент получает награду или штраф за действия: так учатся игровые программы и роботы.",
				options: []option{{"Когда есть размеченные примеры с ответами", false}, {"Когда агент получает награду или штраф за действия", true}, {"Когда нужно разбить данные на группы", false}}},
			{prompt: "Для честной оценки качества модели нужно использовать…", explanation: "Оценка на данных, которые модель не видела, показывает, как она будет работать в реальности.",
				options: []option{{"Только обучающие данные", false}, {"Данные, которые модель не видела при обучении", true}, {"Любые данные, это не важно", false}}},
			{prompt: "Выберите все вопросы, относящиеся к этике применения ИИ.", typ: "MULTIPLE_CHOICE", explanation: "Предвзятость, приватность и ответственность — ключевые этические вопросы. Скорость интерфейса к этике не относится.",
				options: []option{{"Предвзятость и справедливость", true}, {"Приватность данных", true}, {"Цвет оформления интерфейса", false}, {"Ответственность за ошибки системы", true}}},
		}},
	}, {
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
		}}}, {
		slug: "intro-to-ai", title: "Жасанды интеллектке кіріспе",
		summary:     "Жасанды интеллекттің негізгі ұғымдары, тарихы және күнделікті өмірдегі қолданылуы. Бағдарламалау тәжірибесі қажет емес.",
		description: "Бұл курс жасанды интеллект әлеміне алғашқы қадам жасағысы келетіндерге арналған.",
		language:    "kk", level: "BEGINNER", track: "ai-foundations", hours: 12, published: "2026-09-10T09:00:00Z",
		outcomes: []string{"ЖИ, машиналық оқыту және терең оқыту ұғымдарын ажырату", "ЖИ-дің этикалық мәселелерін түсіну"},
		modules:  outline("Жасанды интеллект деген не?", "ЖИ тарихы мен негізгі кезеңдері", "Машиналық оқытуға алғашқы қадам", "ЖИ этикасы және жауапкершілігі"),
	},
	{
		slug: "python-for-data-analysis", title: "Python для анализа данных",
		summary:     "Основы Python, NumPy и pandas: загрузка, очистка и визуализация данных для будущих задач машинного обучения.",
		description: "Практический курс для тех, кто хочет уверенно работать с данными перед изучением машинного обучения.",
		language:    "ru", level: "BEGINNER", track: "ai-foundations", hours: 20, published: "2026-08-20T09:00:00Z",
		outcomes: []string{"Писать простые программы на Python", "Очищать и анализировать табличные данные в pandas"},
		modules:  outline("Основы Python", "NumPy: работа с массивами", "pandas: таблицы и очистка данных", "Визуализация с matplotlib"),
	},
	{
		slug: "deep-learning-neural-networks", title: "Нейронные сети и глубокое обучение",
		summary:     "От перцептрона до трансформеров: обучение нейросетей на PyTorch, регуляризация и оптимизация.",
		description: "Курс для студентов, уже знакомых с основами машинного обучения.",
		language:    "ru", level: "ADVANCED", track: "deep-learning", hours: 40, published: "2026-09-15T09:00:00Z",
		outcomes:      []string{"Обучать и отлаживать нейросети на PyTorch", "Понимать устройство трансформеров"},
		prerequisites: []string{"Основы машинного обучения", "Python и NumPy", "Линейная алгебра"},
		modules: outline("Перцептрон и многослойные сети", "Обратное распространение ошибки", "Свёрточные сети (CNN)",
			"Рекуррентные сети и трансформеры", "Регуляризация и оптимизация"),
	},
	{
		slug: "computer-vision-pytorch", title: "Computer Vision with PyTorch",
		summary:     "Train CNNs for image classification, then move on to object detection and segmentation with modern architectures.",
		description: "A hands-on course in modern computer vision.",
		language:    "en", level: "ADVANCED", track: "computer-vision", hours: 36, published: "2026-09-25T09:00:00Z",
		outcomes:      []string{"Fine-tune pretrained vision models", "Build an object detection pipeline"},
		prerequisites: []string{"Deep learning basics", "PyTorch"},
		modules:       outline("Images as tensors", "Convolutional neural networks", "Transfer learning", "Object detection", "Image segmentation"),
	},
	{
		slug: "kazakh-nlp", title: "Қазақ тіліне арналған табиғи тілді өңдеу",
		summary:     "Қазақ тіліндегі мәтіндерді токенизациялау, морфологиялық талдау және трансформер модельдерін қолдану.",
		description: "Қазақ тілінің ерекшеліктерін ескере отырып, NLP әдістерін практикада үйренеміз.",
		language:    "kk", level: "INTERMEDIATE", track: "nlp", hours: 24, published: "2026-10-01T09:00:00Z",
		outcomes:      []string{"Қазақ тіліндегі мәтінді алдын ала өңдеу", "Мәтінді жіктеу моделін оқыту"},
		prerequisites: []string{"Python", "Машиналық оқыту негіздері"},
		modules: outline("Қазақ тілінің морфологиясы және токенизация", "Сөз векторлары (word embeddings)",
			"Трансформер модельдері", "Мәтінді жіктеу және атаулы нысандарды тану"),
	},
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
