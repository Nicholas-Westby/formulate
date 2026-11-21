namespace Formulate.BackOffice.DependencyInjection
{
    using Umbraco.Cms.Core.DependencyInjection;

    public static partial class UmbracoBuilderExtensions
    {
        public static IUmbracoBuilder AddFormulateBackOffice(this IUmbracoBuilder builder)
        {
            builder.AddFormDefinitions();

            builder.AddFormulateConfiguration();
            builder.AddFormulateUtilities();
            builder.AddFormulateNotificationHandlers();

            return builder;
        }
    }
}
