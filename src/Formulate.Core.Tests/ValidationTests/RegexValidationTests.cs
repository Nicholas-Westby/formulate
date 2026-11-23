namespace Formulate.Core.Tests.ValidationTests
{
    using System;
    using System.Collections.Generic;
    using System.Diagnostics;
    using Formulate.Core.Configuration;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities.Internal;
    using Formulate.Core.Validations;
    using Formulate.Core.Validations.Regex;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Microsoft.Extensions.Primitives;
    using Xunit;

    public class RegexValidationTests
    {
        [Fact]
        public void Regex_validation_runs_on_server()
        {
            var validation = Create("^[0-9]{5}$", "Enter a five digit code.");

            Assert.Equal(new[] { "Enter a five digit code." }, validation.ValidateStrings("1234"));
            Assert.Empty(validation.ValidateStrings("12345"));
        }

        [Fact]
        public void Empty_values_are_tested_like_the_browser_does()
        {
            var strict = Create("^\\d+$", "Digits.");
            var lenient = Create("^\\d*$", "Digits.");

            Assert.Equal(new[] { "Digits." }, strict.ValidateStrings(""));
            Assert.Equal(new[] { "Digits." }, strict.ValidateStrings(StringValues.Empty));
            Assert.Equal(new[] { "Digits." }, strict.ValidateStrings(new StringValues((string)null)));
            Assert.Empty(lenient.ValidateStrings(""));
            Assert.Empty(lenient.ValidateStrings(StringValues.Empty));
        }

        [Fact]
        public void Digits_and_word_characters_are_ascii_only_like_the_browser()
        {
            var digits = Create("^\\d+$", "Digits.");
            var word = Create("^\\w+$", "Word.");

            Assert.Empty(digits.ValidateStrings("123"));
            Assert.Equal(new[] { "Digits." }, digits.ValidateStrings("\u0661\u0662\u0663"));
            Assert.Equal(new[] { "Word." }, word.ValidateStrings("caf\u00e9"));
        }

        [Fact]
        public void A_pattern_valid_only_in_dotnet_still_works()
        {
            var validation = Create("^(?<code>[a-z]+)\\k<code>$|^(?i)ABC$", "No.");

            Assert.Empty(validation.ValidateStrings("abc"));
            Assert.Equal(new[] { "No." }, validation.ValidateStrings("zzz1"));
        }

        [Fact]
        public void Files_are_checked_by_name()
        {
            var validation = Create("\\.pdf$", "Pdf only.");

            Assert.Empty(validation.ValidateFiles(new[] { new FormFileValue { Name = "cv.pdf" } }));
            Assert.Equal(new[] { "Pdf only." }, validation.ValidateFiles(new[] { new FormFileValue { Name = "cv.exe" } }));
        }

        [Fact]
        public void The_same_pattern_is_compiled_once()
        {
            var first = RegexValidation.GetRegex("^cache-test-[0-9]+$");
            var second = RegexValidation.GetRegex("^cache-test-[0-9]+$");

            Assert.NotNull(first);
            Assert.Same(first, second);
        }

        [Fact]
        public void Regex_validation_checks_every_value()
        {
            var validation = Create("^[a-z]+$", "Letters only.");

            Assert.Empty(validation.ValidateStrings(new StringValues(new[] { "abc", "def" })));
            Assert.Equal(new[] { "Letters only." }, validation.ValidateStrings(new StringValues(new[] { "abc", "D3F" })));
        }

        [Fact]
        public void Regex_validation_does_nothing_when_server_side_validation_is_disabled()
        {
            var validation = Create("^[0-9]{5}$", "Enter a five digit code.", enabled: false);

            Assert.Empty(validation.ValidateStrings("nope"));
        }

        [Fact]
        public void Invalid_regex_pattern_is_logged_and_treated_as_a_pass()
        {
            var logger = new CapturingLogger();
            var validation = Create("([unclosed", "Never shown.", logger: logger);

            Assert.Empty(validation.ValidateStrings("anything"));
            var entry = Assert.Single(logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains("([unclosed", entry.Message);
        }

        [Fact]
        public void Catastrophic_regex_times_out_as_failure_and_logs()
        {
            var logger = new CapturingLogger();
            var validation = Create("^(a+)+$", "Never shown.", logger: logger);
            var value = new string('a', 64) + "!";

            var clock = Stopwatch.StartNew();
            var errors = validation.ValidateStrings(value);
            clock.Stop();

            Assert.Equal(new[] { "Never shown." }, errors);
            Assert.InRange(clock.Elapsed, TimeSpan.FromMilliseconds(500), TimeSpan.FromSeconds(10));
            var entry = Assert.Single(logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains("^(a+)+$", entry.Message);
        }

        [Fact]
        public void Blank_pattern_matches_everything()
        {
            var validation = Create("", "Never shown.");

            Assert.Empty(validation.ValidateStrings("anything"));
        }

        [Fact]
        public void The_option_is_on_by_default()
        {
            Assert.True(new FormulateSubmissionsOptions().EnableServerSideValidation);
            Assert.Equal("Formulate:Submissions", FormulateSubmissionsOptions.SectionName);
        }

        private static Validation Create(string pattern, string message, bool enabled = true, CapturingLogger logger = null)
        {
            var json = new JsonUtility(new NewtonsoftJsonSerializer());
            var definition = new RegexValidationDefinition(
                json,
                Options.Create(new FormulateSubmissionsOptions { EnableServerSideValidation = enabled }),
                logger ?? new CapturingLogger());
            var data = Newtonsoft.Json.JsonConvert.SerializeObject(new { regex = pattern, message });

            return definition.CreateValidation(new PersistedValidation
            {
                Id = Guid.NewGuid(),
                KindId = definition.KindId,
                Data = data
            });
        }

        private sealed class CapturingLogger : ILogger<RegexValidation>
        {
            public List<(LogLevel Level, string Message)> Entries { get; } = new List<(LogLevel, string)>();

            public IDisposable BeginScope<TState>(TState state) => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception,
                Func<TState, Exception, string> formatter)
            {
                Entries.Add((logLevel, formatter(state, exception)));
            }
        }
    }
}
