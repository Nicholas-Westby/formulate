# Plain JavaScript Basic theme

The Plain JavaScript template renders forms with no styles of its own. The Basic theme is an optional stylesheet that makes those forms look finished: bordered fields, labels that act as placeholders, styled checkboxes and radio buttons, flat buttons with a small shadow, red validation messages and a 12 column grid.

The theme only targets the `formulate__...` class names the renderer produces, so it does not affect the rest of your page.

## Turn it on

Set the theme in `appsettings.json`:

```json
{
  "Formulate": {
    "PlainJavaScript": {
      "Theme": "basic"
    }
  }
}
```

The valid values are `"none"` (the default) and `"basic"`. With `"basic"`, the template adds a `<link>` to `/App_Plugins/Formulate/PlainJavaScript/themes/basic.min.css` once per page, even when the page has several forms.

If you prefer to add the stylesheet yourself, leave `Theme` as `"none"` and link either file from your layout:

```html
<link rel="stylesheet" href="/App_Plugins/Formulate/PlainJavaScript/themes/basic.min.css" />
```

`basic.css` is the same stylesheet, not minified.

## Change the look

The theme is written in Sass (SCSS syntax). The NuGet package ships only the compiled CSS, so get the source from the Formulate repository at [`src/Formulate.Extensions.PlainJavaScriptTemplate/Client/themes/basic/`](https://github.com/Nicholas-Westby/formulate/tree/v5/main/src/Formulate.Extensions.PlainJavaScriptTemplate/Client/themes/basic). Copy that `basic` folder into your own project, next to the Sass file you compile, then compile it with your own values.

The values you can change are Sass variables in the `settings` folder, grouped by kind (`_colors.scss`, `_sizes.scss`, `_spacing.scss`, `_borders.scss`, `_fonts.scss`, `_shadows.scss`, `_timings.scss`, `_breakpoints.scss` and `_gradients.scss`). Every variable starts with `$formulate-` and has a default, so you only set the ones you want to change.

Use `@use ... with (...)` in your own Sass file:

```scss
@use "basic/app" with (
  $formulate-color--border: #48a,
  $formulate-color--error: #c0392b,
  $formulate-size--field-height: 44px
);
```

Then install [dart-sass](https://sass-lang.com/dart-sass) in your project and compile your file:

```
npm install --save-dev sass
npx sass my-forms.scss wwwroot/css/my-forms.css
```

If the `basic` folder lives somewhere else, tell Sass where to look with `--load-path`, for example `npx sass --load-path=styles/vendor my-forms.scss wwwroot/css/my-forms.css`.

Link the compiled file from your layout and leave `Theme` as `"none"`, so the default theme is not loaded as well.

For example, `$formulate-color--border` sets the color of every border on the form. Changing it to `#48a` gives blue borders on the fields, checkboxes, radio buttons and buttons.

The Basic theme needs dart-sass 1.33 or later, because it uses the `@use` and `@forward` rules and `math.div`.

## Notes

- A radio button list or extended radio button list set to Horizontal has the class `formulate__field--radio-list--horizontal` (or `formulate__field--extended-radio-list--horizontal`), and the theme lays its items out in a row that wraps on narrow screens. A list set to Vertical has `--vertical` and the theme shows one item to a line. A list left on "As the template lays them out" has neither class and looks as it always did in the theme. Without the theme, the class is there for your own CSS.
- The renderer hides inactive steps in a multi-step form with the `hidden` attribute. The theme includes a rule that keeps anything inside a Formulate form with that attribute hidden, even over `!important` styles of your own, so keep it if you write your own styles for steps.
- Multi-step forms slide between steps using the `formulate__step--animating` class. If you want a different animation, change the keyframes in `settings/_animations.scss` and the rules in `steps/_steps.scss`.
- If you want to style forms from scratch, skip the theme and target the `formulate__...` classes directly.
