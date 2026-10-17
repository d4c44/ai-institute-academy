package main

import (
	"encoding/json"
	"os"
)

// dump writes the demo content as JSON for the site's built-in demo mode (src/demo/content.json),
// so the example courses are defined once, in this file's siblings, and not retyped in TypeScript.
//
//	go run ./cmd/seed dump ../src/demo/content.json
func dump(path string) error {
	type jOption struct {
		Text    string `json:"text"`
		Correct bool   `json:"correct"`
	}
	type jQuestion struct {
		Prompt      string    `json:"prompt"`
		Type        string    `json:"type"`
		Explanation string    `json:"explanation"`
		Options     []jOption `json:"options"`
	}
	type jQuiz struct {
		Title     string      `json:"title"`
		Passing   int         `json:"passing"`
		Questions []jQuestion `json:"questions"`
	}
	type jLesson struct {
		Title   string `json:"title"`
		Content string `json:"content"`
		Minutes int    `json:"minutes"`
		Preview bool   `json:"preview"`
	}
	type jModule struct {
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Lessons     []jLesson `json:"lessons"`
		Quiz        *jQuiz    `json:"quiz"`
	}
	type jInstructor struct {
		Name     string `json:"name"`
		Headline string `json:"headline"`
		Bio      string `json:"bio"`
	}
	type jCourse struct {
		Slug          string               `json:"slug"`
		Title         string               `json:"title"`
		Summary       string               `json:"summary"`
		Description   string               `json:"description"`
		Language      string               `json:"language"`
		Level         string               `json:"level"`
		Track         string               `json:"track"`
		Hours         int                  `json:"hours"`
		Published     string               `json:"published"`
		Outcomes      []string             `json:"outcomes"`
		Prerequisites []string             `json:"prerequisites"`
		Modules       []jModule            `json:"modules"`
		FinalExam     *jQuiz               `json:"finalExam"`
		Instructor    jInstructor          `json:"instructor"`
		I18n          map[string]*trCourse `json:"i18n"`
	}
	type jTrack struct {
		Slug        string `json:"slug"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	convQuiz := func(q *quiz) *jQuiz {
		if q == nil {
			return nil
		}
		out := &jQuiz{Title: q.title, Passing: q.passing, Questions: []jQuestion{}}
		if out.Passing == 0 {
			out.Passing = 70
		}
		for _, qu := range q.questions {
			typ := qu.typ
			if typ == "" {
				typ = "SINGLE_CHOICE"
			}
			jq := jQuestion{Prompt: qu.prompt, Type: typ, Explanation: qu.explanation, Options: []jOption{}}
			for _, o := range qu.options {
				jq.Options = append(jq.Options, jOption{Text: o.text, Correct: o.correct})
			}
			out.Questions = append(out.Questions, jq)
		}
		return out
	}

	trs, err := loadTranslations()
	if err != nil {
		return err
	}

	payload := struct {
		Tracks  []jTrack  `json:"tracks"`
		Courses []jCourse `json:"courses"`
	}{Tracks: []jTrack{}, Courses: []jCourse{}}

	for _, t := range tracks {
		payload.Tracks = append(payload.Tracks, jTrack{Slug: t.slug, Name: t.name, Description: t.description})
	}
	for _, c := range courses {
		teacher := people[c.instructor]
		if c.instructor == "" {
			teacher = people["nurlanova"]
		}
		jc := jCourse{
			Instructor: jInstructor{Name: teacher.name, Headline: teacher.headline, Bio: teacher.bio},
			Slug:       c.slug, Title: c.title, Summary: c.summary, Description: c.description,
			Language: c.language, Level: c.level, Track: c.track, Hours: c.hours, Published: c.published,
			Outcomes: nonNil(c.outcomes), Prerequisites: nonNil(c.prerequisites),
			Modules: []jModule{}, FinalExam: convQuiz(c.finalExam), I18n: map[string]*trCourse{},
		}
		if t := trs[c.slug]; t != nil {
			jc.I18n = t
		}
		for _, m := range c.modules {
			jm := jModule{Title: m.title, Description: m.description, Lessons: []jLesson{}, Quiz: convQuiz(m.quiz)}
			for _, l := range m.lessons {
				jm.Lessons = append(jm.Lessons, jLesson{Title: l.title, Content: l.content, Minutes: l.minutes, Preview: l.preview})
			}
			jc.Modules = append(jc.Modules, jm)
		}
		payload.Courses = append(payload.Courses, jc)
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}
