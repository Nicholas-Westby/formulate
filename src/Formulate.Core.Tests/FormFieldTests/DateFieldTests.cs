namespace Formulate.Core.Tests.FormFieldTests
{
    using System;
    using System.Globalization;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.Date;
    using Formulate.Core.Submissions.Requests;
    using Microsoft.Extensions.Primitives;
    using Xunit;

    public class DateFieldTests
    {
        private static DateField Create(string data = null, bool mandatory = false)
        {
            var definition = new DateFieldDefinition();
            var field = Assert.IsType<DateField>(definition.CreateField(new TestFieldSettings { Data = data, KindId = definition.KindId }));

            if (mandatory)
            {
                field.Validations = new[] { TestFieldSettings.Mandatory("Pick a date.") };
            }

            return field;
        }

        private static FormFieldValidationResult Validate(DateField field, params string[] posted)
        {
            return field.Validate(posted.Length == 0 ? FormFieldValues.Empty : new StringFormFieldValues(new StringValues(posted)));
        }

        [Fact]
        public void Date_has_the_formulate_3_kind_id()
        {
            Assert.Equal(Guid.Parse("E70CB78CCF52461198B4556382F23119"), new DateFieldDefinition().KindId);
        }

        [Theory]
        [InlineData("2026-11-05")]
        [InlineData("2024-02-29")]
        [InlineData("0001-01-01")]
        public void Date_rejects_invalid_and_accepts_iso(string iso)
        {
            Assert.Empty(Validate(Create(), iso).ErrorMessages);

            // The same date in any other spelling, or with anything added, is not accepted.
            var invalid = new[] { iso.Replace('-', '/'), iso.Replace("-", string.Empty), iso + "x", iso + "T00:00:00", iso[..^2] + "99", iso[2..] };

            foreach (var posted in invalid)
            {
                Assert.Equal(new[] { DateField.InvalidMessage }, Validate(Create(), posted).ErrorMessages);
            }
        }

        [Theory]
        [InlineData("11/05/2026")]
        [InlineData("05.11.2026")]
        [InlineData("2026-13-01")]
        [InlineData("2026-02-30")]
        [InlineData("2023-02-29")]
        [InlineData("2026-1-5")]
        [InlineData("26-11-05")]
        [InlineData(" 2026-11-05")]
        [InlineData("2026-11-05 ")]
        [InlineData("2026-11-05T10:00:00")]
        [InlineData("Sat Nov 21 2026 10:30:00 GMT-0800 (Pacific Standard Time)")]
        [InlineData("not a date")]
        [InlineData("2026-11-0٥")]
        public void Date_rejects_anything_but_iso(string posted)
        {
            var result = Validate(Create(), posted);

            Assert.Equal(new[] { DateField.InvalidMessage }, result.ErrorMessages);
        }

        [Fact]
        public void Date_rejects_when_one_of_several_values_is_invalid()
        {
            Assert.NotEmpty(Validate(Create(), "2026-11-05", "nope").ErrorMessages);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void An_empty_date_is_valid_unless_mandatory(string posted)
        {
            Assert.Empty(Validate(Create(), posted).ErrorMessages);
            Assert.Empty(Validate(Create()).ErrorMessages);
            Assert.Equal(new[] { "Pick a date." }, Validate(Create(mandatory: true), posted).ErrorMessages);
            Assert.Equal(new[] { "Pick a date." }, Validate(Create(mandatory: true)).ErrorMessages);
        }

        [Fact]
        public void A_mandatory_date_that_is_invalid_gets_only_the_date_message_once()
        {
            Assert.Equal(new[] { DateField.InvalidMessage }, Validate(Create(mandatory: true), "nope").ErrorMessages);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("{}")]
        [InlineData("{\"format\":\"dd/MM/yyyy\"}")]
        public void Date_reads_no_configuration_or_any_stored_value(string data)
        {
            Assert.Empty(Validate(Create(data), "2026-11-05").ErrorMessages);
        }

        [Theory]
        [InlineData("en-US", "2026-11-05", "November 05, 2026")]
        [InlineData("fr-FR", "2026-11-05", "novembre 05, 2026")]
        [InlineData("en-US", "Sat Nov 21 2026 10:30:00 GMT-0800 (Pacific Standard Time)", "November 21, 2026")]
        [InlineData("en-US", "2026-11-05T09:00:00", "November 05, 2026")]
        [InlineData("en-US", "not a date", "not a date")]
        [InlineData("en-US", "", "")]
        public void Date_formats_as_a_long_date_in_the_current_culture(string culture, string value, string expected)
        {
            var previous = CultureInfo.CurrentCulture;

            try
            {
                CultureInfo.CurrentCulture = new CultureInfo(culture);

                Assert.Equal(expected, DateField.Format(value));
                Assert.Equal(expected, Assert.IsAssignableFrom<IFormFieldValueFormatter>(new DateFieldDefinition()).FormatValue(value));
            }
            finally
            {
                CultureInfo.CurrentCulture = previous;
            }
        }
    }
}
