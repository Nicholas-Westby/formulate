namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    using System.Collections.ObjectModel;
    using System.Dynamic;

    /// <summary>
    /// Values a view reads as properties, such as Model.Values.FirstName. Reading a value that was never
    /// set gives the fallback value instead of an error, so a view can name a field a form does not have.
    /// </summary>
    /// <remarks>
    /// Ported from Formulate Pro. Names ignore case, spaces and symbols, so a field named "Page Name" is
    /// read as PageName.
    /// </remarks>
    public sealed class SafeExpandoObject : DynamicObject
    {
        /// <summary>
        /// The characters Formulate Pro removed from names.
        /// </summary>
        private static readonly char[] DisallowedCharacters = " ?.-!*#$&()+=/\\{}:;'\"<>,~`".ToCharArray();

        private readonly OrderedDictionary<string, object?> _values = new(StringComparer.OrdinalIgnoreCase);

        private readonly object? _fallbackValue;

        /// <summary>
        /// Initializes a new instance of the <see cref="SafeExpandoObject"/> class.
        /// </summary>
        /// <param name="fallbackValue">The value of a member that was never set.</param>
        public SafeExpandoObject(object? fallbackValue = null)
        {
            _fallbackValue = fallbackValue;
        }

        /// <summary>
        /// Sets the value of a member. Spaces and symbols are removed from the name; a name with nothing
        /// left is ignored.
        /// </summary>
        public void SetValue(string? name, object? value)
        {
            var key = new string((name ?? string.Empty).Where(x => DisallowedCharacters.Contains(x) == false).ToArray());

            if (key.Length > 0)
            {
                _values[key] = value;
            }
        }

        /// <summary>
        /// Gets the values in the order they were set, so a view can loop through them.
        /// </summary>
        public ReadOnlyDictionary<string, object?> GetRawValues() => new(_values);

        /// <inheritdoc />
        public override bool TryGetMember(GetMemberBinder binder, out object? result)
        {
            result = _values.TryGetValue(binder.Name, out var value) ? value : _fallbackValue;

            return true;
        }

        /// <inheritdoc />
        public override bool TrySetMember(SetMemberBinder binder, object? value)
        {
            _values[binder.Name] = value;

            return true;
        }

        /// <inheritdoc />
        public override IEnumerable<string> GetDynamicMemberNames() => _values.Keys;
    }
}
