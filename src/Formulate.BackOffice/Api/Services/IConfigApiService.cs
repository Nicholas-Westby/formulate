namespace Formulate.BackOffice.Api.Services
{
    using Formulate.BackOffice.Api.Models.Config;

    /// <summary>
    /// Provides the settings the back office client needs.
    /// </summary>
    public interface IConfigApiService
    {
        /// <summary>
        /// Gets the settings, from what the site configured and the defaults for what it did not.
        /// </summary>
        FormulateConfigResponseModel Get();
    }
}
