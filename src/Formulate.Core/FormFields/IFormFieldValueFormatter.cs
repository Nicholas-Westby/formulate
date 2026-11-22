namespace Formulate.Core.FormFields
{
    /// <summary>
    /// An optional contract for a form field definition that writes its values for people and receivers
    /// (the Email handler and Send Data) differently from how the visitor posted them.
    /// </summary>
    /// <remarks>
    /// This is a separate interface so that custom form field definitions keep compiling. A definition that
    /// does not implement it has its values written as posted. Store Data always keeps the posted value.
    /// </remarks>
    public interface IFormFieldValueFormatter
    {
        /// <summary>
        /// Formats one posted value.
        /// </summary>
        /// <param name="value">The posted value.</param>
        /// <returns>The value to write.</returns>
        string FormatValue(string value);
    }
}
