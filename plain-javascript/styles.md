---
layout: page
title: Styling the Formulate Plain JavaScript Grid
---

# Plain JavaScript Renderer

Formulate 5 uses the plain JavaScript renderer. The class names on this page are the same as in Formulate 3, so existing styles keep working.

If you don't want to write your own styles, you can turn on the optional [basic theme](/pro/basic-theme).

# Styling the Grid

This CodePen shows how you can style the grid rendered by Formulate's plain JavaScript template: [https://codepen.io/anon/pen/oPOOYZ?editors=1100](https://codepen.io/anon/pen/oPOOYZ?editors=1100)

Note that it includes a style reset you may want to remove, as you likely already have it in your styles.
Also, it includes some decorative styles near the bottom that are purely for this demo, so you'll want to remove those as well.

This CodePen shows the SCSS flavor of Sass, but you can click the drop down to view the compiled CSS if you aren't using Sass.

# Styling Radio Button Lists

The Radio Button List and the Extended Radio Button List have an Orientation setting, Horizontal or Vertical. The renderer adds a class for it to the list's fieldset (the element that holds the items):

| Field | Horizontal | Vertical |
|-------|------------|----------|
| Radio Button List | `formulate__field--radio-list--horizontal` | `formulate__field--radio-list--vertical` |
| Extended Radio Button List | `formulate__field--extended-radio-list--horizontal` | `formulate__field--extended-radio-list--vertical` |

The letter case of the setting doesn't matter. A list left on "As the template lays them out" (or with a value the renderer doesn't know) gets neither class, and is laid out as your template or theme lays it out. The class is built from the field's type, so a custom field that extends the radio list renderer gets `formulate__field--<its type>--horizontal` or `--vertical`.

With the [basic theme](/pro/basic-theme), a Horizontal list is a row that wraps on narrow screens, a Vertical list stacks its items, and a list with no class looks as it always did (the items run along the line). Without the theme, the class is there for your own styles:

```css
.formulate__field--radio-list--horizontal {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
}
```

# Styling Multi-Step Forms

You can use this CSS style to hide steps that are inactive in multi-step forms:

```css
.formulate__row--inactive {
    display: none;
}
```

# reCAPTCHA Fields

The reCAPTCHA field renders an element with the classes `formulate__field` and `formulate__field--recaptcha`, and Google's script fills it with the widget. The script is only added to the page when `Formulate:Recaptcha:SiteKey` is set. Without a site key, the field is an empty element (without the `g-recaptcha` class), the browser makes no request to Google, and the console shows one warning for the page. The server rejects the form until both the site key and the secret key are set.
