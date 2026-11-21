namespace Formulate.BackOffice.Utilities.CreateOptions.FormFields
{
    using Formulate.BackOffice.Utilities.CreateOptions;
    using System.Collections.Generic;

    public interface IGetFormFieldOptions
    {
        IReadOnlyCollection<CreateItemOption> Get();
    }
}
