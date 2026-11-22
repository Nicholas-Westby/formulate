namespace Formulate.Core.Validations.Regex
{
    using System;
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text.RegularExpressions;
    using Formulate.Core.Submissions.Requests;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Primitives;

    /// <summary>
    /// A validation kind that validates against a regular expression.
    /// </summary>
    public sealed class RegexValidation : Validation<RegexValidationConfiguration>
    {
        /// <summary>
        /// How long one value may take to match before the check gives up. A pattern that backtracks
        /// without end must not hold a request thread.
        /// </summary>
        public static readonly TimeSpan MatchTimeout = TimeSpan.FromSeconds(1);

        private static readonly ConcurrentDictionary<string, Regex> Cache = new ConcurrentDictionary<string, Regex>();

        private readonly bool _serverSideValidationEnabled;

        private readonly ILogger _logger;

        /// <inheritdoc />
        public RegexValidation(IValidationSettings settings, RegexValidationConfiguration configuration) : this(settings, configuration, true, null)
        {
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="RegexValidation"/> class.
        /// </summary>
        /// <param name="settings">The validation settings.</param>
        /// <param name="configuration">The validation configuration.</param>
        /// <param name="serverSideValidationEnabled">Whether values are checked on the server.</param>
        /// <param name="logger">The logger, or null to log nothing.</param>
        public RegexValidation(IValidationSettings settings, RegexValidationConfiguration configuration, bool serverSideValidationEnabled, ILogger logger) : base(settings, configuration)
        {
            _serverSideValidationEnabled = serverSideValidationEnabled;
            _logger = logger;
        }

        /// <summary>
        /// Checks the values the way the browser renderer does: the pattern may match anywhere in a value,
        /// an empty value is tested as "" (so a pattern that allows an empty field must match ""), and
        /// several values must all match. An invalid pattern, or one that times out, is logged and
        /// treated as a pass, so one bad pattern never blocks every submission or ties up the server.
        /// </summary>
        public override IReadOnlyCollection<string> ValidateStrings(StringValues values)
        {
            if (values.Count == 0)
            {
                return Check(new[] { string.Empty });
            }

            return Check(values.Select(x => x ?? string.Empty));
        }

        /// <summary>
        /// Checks the names of the files, as the renderer does; no file is tested as "".
        /// </summary>
        public override IReadOnlyCollection<string> ValidateFiles(IReadOnlyCollection<FormFileValue> values)
        {
            if (values is null || values.Count == 0)
            {
                return Check(new[] { string.Empty });
            }

            return Check(values.Select(x => x.Name ?? string.Empty));
        }

        private IReadOnlyCollection<string> Check(IEnumerable<string> texts)
        {
            if (_serverSideValidationEnabled == false)
            {
                return Array.Empty<string>();
            }

            var regex = GetRegex(Configuration?.Regex ?? string.Empty);

            if (regex is null)
            {
                _logger?.LogWarning(
                    "The regular expression {Pattern} of validation {ValidationId} is not valid, so values are accepted.",
                    Configuration?.Regex, Id);

                return Array.Empty<string>();
            }

            try
            {
                foreach (var text in texts)
                {
                    if (regex.IsMatch(text) == false)
                    {
                        return new[] { Configuration.Message };
                    }
                }
            }
            catch (RegexMatchTimeoutException)
            {
                _logger?.LogWarning(
                    "The regular expression {Pattern} of validation {ValidationId} took longer than {Timeout} to check a value, so the value was accepted.",
                    Configuration.Regex, Id, MatchTimeout);
            }

            return Array.Empty<string>();
        }

        /// <summary>
        /// Gets the compiled regular expression for a pattern, or null when the pattern is not valid.
        /// The browser's rules are used (ECMAScript mode: \d and \w are ASCII only) and, when the pattern
        /// is only valid in .NET, the default options. Patterns are written by administrators and are few,
        /// so each is compiled once and kept.
        /// </summary>
        internal static Regex GetRegex(string pattern)
        {
            return Cache.GetOrAdd(pattern, Compile);
        }

        private static Regex Compile(string pattern)
        {
            foreach (var options in new[] { RegexOptions.ECMAScript, RegexOptions.None })
            {
                try
                {
                    return new Regex(pattern, options, MatchTimeout);
                }
                catch (ArgumentException)
                {
                    // Not valid with these options: try the next.
                }
            }

            return null;
        }
    }
}
