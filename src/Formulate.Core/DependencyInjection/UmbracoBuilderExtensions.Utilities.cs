namespace Formulate.Core.DependencyInjection
{
    // Namespaces.
    using Formulate.Core.Configuration;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Umbraco.Cms.Core.DependencyInjection;
    using Utilities;
    using Utilities.Internal;
    using Utilities.Submissions;

    public partial class UmbracoBuilderExtensions
    {
        /// <summary>
        /// Adds Formulates utilities.
        /// </summary>
        /// <param name="builder">The Umbraco builder.</param>
        /// <returns>The current <see cref="IUmbracoBuilder"/>.</returns>
        private static IUmbracoBuilder AddFormulateUtilities(this IUmbracoBuilder builder)
        {
            builder.Services.Configure<FormulateSubmissionsOptions>(builder.Config.GetSection(FormulateSubmissionsOptions.SectionName));

            builder.Services.AddSingleton<IGetDataValuesItemsUtility, GetDataValuesItemsUtility>();
            builder.Services.AddSingleton<IJsonUtility, JsonUtility>();
            builder.Services.AddSingleton<IJsonSerializer, NewtonsoftJsonSerializer>();

            builder.Services.AddScoped<IValidateFormSubmissionRequest, ValidateFormSubmissionRequest>();
            builder.Services.AddScoped<ISubmitFormSubmissionRequest, SubmitFormSubmissionRequest>();

            return builder;
        }
    }
}